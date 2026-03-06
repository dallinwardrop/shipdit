import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Webhook signature verification failed:', msg)
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 })
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      // Payment method attached and authorized — mark pledge as held
      const pi = event.data.object as Stripe.PaymentIntent
      await admin
        .from('pledges')
        .update({ status: 'held', stripe_customer_id: pi.customer as string | null })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      await admin
        .from('pledges')
        .update({ status: 'captured', captured_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      await admin
        .from('pledges')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object as Stripe.PaymentIntent
      // Mark as refunded if it was held (hold released)
      await admin
        .from('pledges')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', pi.id)
        .in('status', ['pending', 'held'])
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      if (charge.payment_intent) {
        await admin
          .from('pledges')
          .update({ status: 'refunded', refunded_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', charge.payment_intent as string)
      }
      break
    }

    default:
      // Unhandled event type — ignore
      break
  }

  return NextResponse.json({ received: true })
}
