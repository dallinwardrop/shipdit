import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, mode = 'one_time' } = body as {
      amount: number
      mode?: 'one_time' | 'monthly'
    }

    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Minimum support is $1.' }, { status: 400 })
    }

    // Get or create Stripe customer
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('email').eq('id', user.id).single()

    let customerId: string | undefined
    const existingCustomers = await stripe.customers.list({ email: profile?.email, limit: 1 })
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else if (profile?.email) {
      const customer = await stripe.customers.create({ email: profile.email })
      customerId = customer.id
    }

    if (mode === 'monthly') {
      if (!customerId) {
        return NextResponse.json({ error: 'Could not create payment customer.' }, { status: 500 })
      }

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price_data: { currency: 'usd', product_data: { name: 'Shipdit Monthly Support' }, recurring: { interval: 'month' }, unit_amount: amount } }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { user_id: user.id, type: 'support', mode: 'monthly' },
      })

      const invoice = subscription.latest_invoice as Stripe.Invoice
      const pi = invoice.payment_intent as Stripe.PaymentIntent

      return NextResponse.json({
        success: true,
        subscriptionId: subscription.id,
        clientSecret: pi.client_secret,
      })
    }

    // One-time PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      customer: customerId,
      metadata: { user_id: user.id, type: 'support', mode: 'one_time' },
      description: 'Shipdit platform support',
    })

    return NextResponse.json({ success: true, client_secret: paymentIntent.client_secret })
  } catch (err) {
    console.error('Support route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
