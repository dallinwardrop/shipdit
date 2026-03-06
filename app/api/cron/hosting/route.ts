import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendHostingReminder, sendHostingOffline, sendHostingFunded } from '@/lib/emails'

// Runs monthly via cron-job.org: GET /api/cron/hosting
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  const { data: apps } = await admin
    .from('app_ideas')
    .select('id, title, slug, hosting_monthly_goal, hosting_collected, hosting_period_start, hosting_status')
    .eq('status', 'built')

  if (!apps || apps.length === 0) {
    return NextResponse.json({ message: 'No shipped apps found.', funded: 0, warnings: 0, offlined: 0 })
  }

  let funded = 0, warnings = 0, offlined = 0

  for (const app of apps) {
    if (!app.slug) continue

    const goal = app.hosting_monthly_goal ?? 0
    const collected = app.hosting_collected ?? 0
    const periodStart = app.hosting_period_start ? new Date(app.hosting_period_start) : null
    const daysSincePeriodStart = periodStart
      ? (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      : 999

    // Helper: get emails of original backers (captured pledges)
    const getBackerEmails = async (): Promise<string[]> => {
      const { data: pledges } = await admin
        .from('pledges')
        .select('user_id')
        .eq('app_idea_id', app.id)
        .eq('status', 'captured')
      if (!pledges || pledges.length === 0) return []
      const userIds = [...new Set(pledges.map((p) => p.user_id))]
      const { data: users } = await admin.from('users').select('email').in('id', userIds)
      return (users ?? []).map((u) => u.email).filter(Boolean) as string[]
    }

    const periodOver = daysSincePeriodStart >= 30

    if (periodOver && goal > 0 && collected >= goal) {
      // Funded this period — reset counter, thank contributors
      await admin
        .from('app_ideas')
        .update({ hosting_collected: 0, hosting_period_start: now.toISOString(), hosting_status: 'active' })
        .eq('id', app.id)

      const { data: contribs } = await admin
        .from('hosting_contributions')
        .select('user_id')
        .eq('app_idea_id', app.id)
        .eq('status', 'captured')

      if (contribs && contribs.length > 0) {
        const userIds = [...new Set(contribs.map((c) => c.user_id).filter(Boolean))] as string[]
        const { data: users } = await admin.from('users').select('email').in('id', userIds)
        users?.forEach((u) => {
          if (u.email) {
            sendHostingFunded(u.email, { appTitle: app.title, slug: app.slug!, totalCollected: collected }).catch(console.error)
          }
        })
      }
      funded++

    } else if (daysSincePeriodStart >= 23 && collected < goal && app.hosting_status !== 'offline') {
      // 7 days left in period, underfunded — send warning
      await admin.from('app_ideas').update({ hosting_status: 'warning' }).eq('id', app.id)
      const daysLeft = Math.max(0, 30 - Math.floor(daysSincePeriodStart))
      const amountNeeded = Math.max(0, goal - collected)
      const emails = await getBackerEmails()
      emails.forEach((email) => {
        sendHostingReminder(email, { appTitle: app.title, slug: app.slug!, amountNeeded, daysLeft }).catch(console.error)
      })
      warnings++

    } else if (periodOver && collected === 0 && app.hosting_status !== 'offline') {
      // Period ended, nothing collected — take offline
      await admin.from('app_ideas').update({ hosting_status: 'offline' }).eq('id', app.id)
      const emails = await getBackerEmails()
      emails.forEach((email) => {
        sendHostingOffline(email, { appTitle: app.title, slug: app.slug! }).catch(console.error)
      })
      offlined++
    }
  }

  return NextResponse.json({ message: 'Hosting cron complete.', funded, warnings, offlined })
}
