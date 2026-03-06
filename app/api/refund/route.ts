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

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const body = await request.json()
    const { pledge_id } = body as { pledge_id: string }

    if (!pledge_id) return NextResponse.json({ error: 'pledge_id required.' }, { status: 400 })

    const { data: pledge } = await admin
      .from('pledges')
      .select('id, amount, status, stripe_payment_intent_id, user_id, app_idea_id')
      .eq('id', pledge_id)
      .single()

    if (!pledge) return NextResponse.json({ error: 'Pledge not found.' }, { status: 404 })

    if (pledge.status === 'refunded') {
      return NextResponse.json({ error: 'Already refunded.' }, { status: 409 })
    }

    if (!['held', 'captured', 'pending'].includes(pledge.status)) {
      return NextResponse.json({ error: `Cannot refund pledge in status: ${pledge.status}` }, { status: 400 })
    }

    if (pledge.status === 'captured') {
      // Issue a full refund
      await stripe.refunds.create({
        payment_intent: pledge.stripe_payment_intent_id,
      })
    } else {
      // Cancel the payment intent (releases the hold)
      await stripe.paymentIntents.cancel(pledge.stripe_payment_intent_id)
    }

    await admin
      .from('pledges')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', pledge_id)

    // Get user email and idea title for notification
    const { data: pledgeUser } = await admin
      .from('users')
      .select('email')
      .eq('id', pledge.user_id)
      .single()

    const { data: idea } = await admin
      .from('app_ideas')
      .select('title, slug')
      .eq('id', pledge.app_idea_id)
      .single()

    if (pledgeUser?.email && idea) {
      await sendEmail({
        to: pledgeUser.email,
        type: 'refund_issued',
        ideaTitle: idea.title,
        ideaSlug: idea.slug ?? undefined,
        refundAmount: pledge.amount,
      }).catch(console.warn)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Refund route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
