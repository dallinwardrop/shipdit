import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import type { PledgeType } from '@/lib/supabase/types'
import { sendPledgeConfirmation } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const body = await request.json()
    const {
      app_idea_id,
      amount,
      type = 'pledge',
      ref_code,
      anonymous = false,
    } = body as {
      app_idea_id: string
      amount: number
      type?: PledgeType
      ref_code?: string
      anonymous?: boolean
    }

    if (!app_idea_id) return NextResponse.json({ error: 'app_idea_id required.' }, { status: 400 })
    if (!amount || amount < 100)
      return NextResponse.json({ error: 'Minimum pledge is $1.' }, { status: 400 })

    // Verify the idea exists and is open for pledges (use admin to bypass RLS)
    const { data: idea } = await admin
      .from('app_ideas')
      .select('id, title, slug, status, funding_deadline')
      .eq('id', app_idea_id)
      .single()

    const PLEDGE_OPEN = ['submitted', 'under_review', 'awaiting_price', 'priced', 'live']
    if (!idea) return NextResponse.json({ error: 'Idea not found.' }, { status: 404 })
    if (!PLEDGE_OPEN.includes(idea.status))
      return NextResponse.json({ error: 'This idea is not currently accepting pledges.' }, { status: 400 })

    // Get or create Stripe customer
    const { data: profile } = await admin
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    let customerId: string | undefined

    const existingCustomers = await stripe.customers.list({ email: profile?.email, limit: 1 })
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else if (profile?.email) {
      const customer = await stripe.customers.create({ email: profile.email })
      customerId = customer.id
    }

    // Create Payment Intent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      capture_method: 'manual',
      payment_method_types: ['card'],
      customer: customerId,
      metadata: {
        user_id: user.id,
        app_idea_id,
        type,
        ref_code: ref_code ?? '',
      },
      description: `Pledge for: ${idea.title}`,
    })

    // Insert pledge record
    // Note: anonymous column requires: ALTER TABLE pledges ADD COLUMN anonymous boolean DEFAULT false;
    const { error: pledgeError } = await admin.from('pledges').insert({
      user_id: user.id,
      app_idea_id,
      amount,
      type,
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId ?? null,
      ref_code: ref_code ?? null,
      is_submitter_pledge: false,
      ...(anonymous ? { anonymous: true } : {}),
    })

    if (pledgeError) {
      console.error('Pledge insert error:', JSON.stringify(pledgeError, null, 2))
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return NextResponse.json({
        error: 'Failed to record pledge.',
        detail: pledgeError.message ?? String(pledgeError),
      }, { status: 500 })
    }

    // Send confirmation email (non-blocking)
    if (profile?.email && idea.slug) {
      sendPledgeConfirmation(profile.email, {
        appTitle: idea.title,
        amount,
        fundingDeadline: idea.funding_deadline ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
        slug: idea.slug,
      }).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    })
  } catch (err) {
    console.error('Pledge route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
