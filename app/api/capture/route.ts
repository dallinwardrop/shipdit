import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    // Verify admin
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const body = await request.json()
    const { app_idea_id } = body as { app_idea_id: string }

    if (!app_idea_id) return NextResponse.json({ error: 'app_idea_id required.' }, { status: 400 })

    // Fetch the idea
    const { data: idea } = await admin
      .from('app_ideas')
      .select('id, title, slug, status')
      .eq('id', app_idea_id)
      .single()

    if (!idea) return NextResponse.json({ error: 'Idea not found.' }, { status: 404 })
    if (idea.status !== 'funded')
      return NextResponse.json({ error: 'Idea must be in funded status to capture.' }, { status: 400 })

    // Fetch all held pledges
    const { data: pledges } = await admin
      .from('pledges')
      .select('id, amount, stripe_payment_intent_id, user_id')
      .eq('app_idea_id', app_idea_id)
      .eq('status', 'held')

    if (!pledges?.length) {
      return NextResponse.json({ error: 'No held pledges to capture.' }, { status: 400 })
    }

    const results = { captured: 0, failed: 0, errors: [] as string[] }

    for (const pledge of pledges) {
      try {
        await stripe.paymentIntents.capture(pledge.stripe_payment_intent_id)

        await admin
          .from('pledges')
          .update({ status: 'captured', captured_at: new Date().toISOString() })
          .eq('id', pledge.id)

        results.captured++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Failed to capture pledge ${pledge.id}:`, msg)
        await admin.from('pledges').update({ status: 'failed' }).eq('id', pledge.id)
        results.failed++
        results.errors.push(msg)
      }
    }

    // Move idea to building status
    await admin
      .from('app_ideas')
      .update({ status: 'building', build_status: 'in_progress' })
      .eq('id', app_idea_id)

    // Notify all pledgers
    const { data: pledgerEmails } = await admin
      .from('pledges')
      .select('users(email)')
      .eq('app_idea_id', app_idea_id)
      .eq('status', 'captured')

    if (pledgerEmails) {
      for (const row of pledgerEmails) {
        const userRow = (row.users as unknown) as { email: string } | null
        if (userRow?.email) {
          await sendEmail({
            to: userRow.email,
            type: 'goal_hit',
            ideaTitle: idea.title,
            ideaSlug: idea.slug ?? undefined,
          }).catch(console.warn)
        }
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error('Capture route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
