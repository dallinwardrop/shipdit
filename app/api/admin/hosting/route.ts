import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendHostingReminder } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const body = await request.json() as {
      idea_id: string
      hosting_monthly_goal?: number
      hosting_status?: string
      send_reminder?: boolean
    }
    const { idea_id, hosting_monthly_goal, hosting_status, send_reminder } = body
    if (!idea_id) return NextResponse.json({ error: 'idea_id required.' }, { status: 400 })

    // Send hosting reminder to all original backers
    if (send_reminder) {
      const { data: idea } = await admin
        .from('app_ideas')
        .select('title, slug, hosting_monthly_goal, hosting_collected')
        .eq('id', idea_id)
        .single()

      if (!idea?.slug) return NextResponse.json({ error: 'Idea not found.' }, { status: 404 })

      const { data: pledges } = await admin
        .from('pledges')
        .select('user_id')
        .eq('app_idea_id', idea_id)
        .eq('status', 'captured')

      if (pledges && pledges.length > 0) {
        const userIds = [...new Set(pledges.map((p) => p.user_id))]
        const { data: users } = await admin.from('users').select('email').in('id', userIds)
        const amountNeeded = Math.max(0, (idea.hosting_monthly_goal ?? 0) - (idea.hosting_collected ?? 0))
        users?.forEach((u) => {
          if (u.email) {
            sendHostingReminder(u.email, {
              appTitle: idea.title,
              slug: idea.slug!,
              amountNeeded,
              daysLeft: 7,
            }).catch(console.error)
          }
        })
      }

      return NextResponse.json({ success: true })
    }

    // Update hosting fields
    const updates: Record<string, unknown> = {}
    if (hosting_monthly_goal !== undefined) updates.hosting_monthly_goal = hosting_monthly_goal
    if (hosting_status !== undefined) updates.hosting_status = hosting_status

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const { error } = await admin.from('app_ideas').update(updates).eq('id', idea_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/hosting error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
