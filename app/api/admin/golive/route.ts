import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendIdeaLive } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { idea_id } = await request.json() as { idea_id: string }
    if (!idea_id) return NextResponse.json({ error: 'idea_id required.' }, { status: 400 })

    const now = new Date()
    // Add 72 hours, then round up to the :58:00 of the next clock hour.
    // The hourly cron fires at :00, giving a 2-minute buffer after the deadline.
    // e.g. approved at 2:15 PM → raw deadline 2:15 PM+72h → rounded to 3:58 PM+72h
    const rawDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    const deadline = new Date(rawDeadline)
    deadline.setMinutes(0, 0, 0)              // snap to the top of the current hour
    deadline.setHours(deadline.getHours() + 1) // advance to the next hour
    deadline.setMinutes(58)                    // set to :58:00

    const { error } = await admin
      .from('app_ideas')
      .update({
        status: 'live',
        live_at: now.toISOString(),
        funding_deadline: deadline.toISOString(),
      })
      .eq('id', idea_id)

    if (error) throw error

    // Email all existing pledgers (non-blocking)
    const { data: idea } = await admin
      .from('app_ideas')
      .select('title, slug, build_price')
      .eq('id', idea_id)
      .single()

    if (idea?.slug && idea.build_price) {
      const { data: pledges } = await admin
        .from('pledges')
        .select('user_id')
        .eq('app_idea_id', idea_id)
        .in('status', ['pending', 'held'])

      if (pledges && pledges.length > 0) {
        const userIds = [...new Set(pledges.map((p) => p.user_id))]
        const { data: pledgers } = await admin
          .from('users')
          .select('email')
          .in('id', userIds)

        const emailPayload = {
          appTitle: idea.title,
          slug: idea.slug,
          buildPrice: idea.build_price,
          fundingDeadline: deadline.toISOString(),
        }
        pledgers?.forEach((u) => {
          if (u.email) sendIdeaLive(u.email, emailPayload).catch(console.error)
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/golive error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
