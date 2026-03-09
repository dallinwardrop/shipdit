import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendPledgeReleased } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { pledge_id } = await request.json() as { pledge_id?: string }
    if (!pledge_id) return NextResponse.json({ error: 'pledge_id required.' }, { status: 400 })

    const admin = createAdminClient()

    // Fetch pledge and verify ownership in a single query — no user_id match = 404
    const { data: pledge } = await admin
      .from('pledges')
      .select('id, status, stripe_payment_intent_id, user_id, app_idea_id, app_ideas(title, slug), users(email)')
      .eq('id', pledge_id)
      .eq('user_id', user.id)
      .single()

    if (!pledge) return NextResponse.json({ error: 'Pledge not found.' }, { status: 404 })

    if (!['held', 'authorized'].includes(pledge.status)) {
      return NextResponse.json(
        { error: 'Only held or authorized pledges can be cancelled.' },
        { status: 400 }
      )
    }

    if (!pledge.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent on this pledge.' }, { status: 400 })
    }

    // Cancel Stripe PaymentIntent
    try {
      await stripe.paymentIntents.cancel(pledge.stripe_payment_intent_id)
    } catch (err) {
      console.error('[cancel-pledge] Stripe cancel failed:', (err as Error).message)
      return NextResponse.json({ error: 'Failed to cancel payment hold.' }, { status: 502 })
    }

    // Update pledge status
    const { error: updateError } = await admin
      .from('pledges')
      .update({ status: 'cancelled' })
      .eq('id', pledge_id)

    if (updateError) {
      console.error('[cancel-pledge] DB update failed:', updateError.message)
      return NextResponse.json({ error: 'Payment cancelled but failed to update record.' }, { status: 500 })
    }

    // Send release email (non-blocking)
    const idea = (pledge.app_ideas as unknown) as { title: string; slug: string | null } | null
    const backerUser = (pledge.users as unknown) as { email: string } | null

    if (idea && backerUser?.email) {
      ;(async () => {
        const resendId = await sendPledgeReleased(backerUser.email, {
          appTitle: idea.title,
          slug: idea.slug,
        })
        await admin.from('email_log').insert({
          to_user_id: pledge.user_id,
          to_email: backerUser.email,
          subject: `Your pledge for "${idea.title}" has been cancelled`,
          type: 'pledge_released',
          app_idea_id: pledge.app_idea_id,
          resend_id: resendId,
        })
      })().catch((err) => console.warn('[cancel-pledge] Email failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cancel-pledge] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
