import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'

// Called daily by Vercel Cron: GET /api/cron/hosting
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const warningThreshold = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days from now

  // Apps expiring within 14 days
  const { data: expiringSoon } = await admin
    .from('live_apps')
    .select('id, official_name, hosting_expires_at, app_ideas(slug)')
    .eq('is_online', true)
    .gt('hosting_expires_at', now.toISOString())
    .lt('hosting_expires_at', warningThreshold.toISOString())

  // Apps already expired
  const { data: alreadyExpired } = await admin
    .from('live_apps')
    .select('id, official_name, hosting_expires_at, app_ideas(slug)')
    .eq('is_online', true)
    .lt('hosting_expires_at', now.toISOString())

  let warningsSent = 0
  let appsOfflined = 0

  // Send expiry warnings
  if (expiringSoon) {
    for (const app of expiringSoon) {
      // Get all donors/pledgers for this app to notify them
      const ideaRef = (app.app_ideas as unknown) as { slug: string } | null

      const { data: donors } = await admin
        .from('hosting_donations')
        .select('users(email)')
        .eq('live_app_id', app.id)

      const emails = new Set<string>()
      donors?.forEach((d) => {
        const u = (d.users as unknown) as { email: string } | null
        if (u?.email) emails.add(u.email)
      })

      for (const email of emails) {
        await sendEmail({
          to: email,
          type: 'hosting_warning',
          ideaTitle: app.official_name,
          ideaSlug: ideaRef?.slug ?? undefined,
          hostingExpiresAt: new Date(app.hosting_expires_at).toLocaleDateString('en-US'),
        }).catch(console.warn)
        warningsSent++
      }
    }
  }

  // Take expired apps offline
  if (alreadyExpired) {
    for (const app of alreadyExpired) {
      await admin.from('live_apps').update({ is_online: false }).eq('id', app.id)

      const ideaRef = (app.app_ideas as unknown) as { slug: string } | null

      const { data: donors } = await admin
        .from('hosting_donations')
        .select('users(email)')
        .eq('live_app_id', app.id)

      const emails = new Set<string>()
      donors?.forEach((d) => {
        const u = (d.users as unknown) as { email: string } | null
        if (u?.email) emails.add(u.email)
      })

      for (const email of emails) {
        await sendEmail({
          to: email,
          type: 'hosting_expired',
          ideaTitle: app.official_name,
          ideaSlug: ideaRef?.slug ?? undefined,
        }).catch(console.warn)
      }

      appsOfflined++
    }
  }

  return NextResponse.json({
    message: 'Hosting cron complete.',
    warnings_sent: warningsSent,
    apps_offlined: appsOfflined,
  })
}
