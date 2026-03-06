import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const admin = createAdminClient()
    const { app_idea_id, amount } = await request.json() as { app_idea_id: string; amount: number }

    if (!app_idea_id) return NextResponse.json({ error: 'app_idea_id required.' }, { status: 400 })
    if (!amount || amount < 100) return NextResponse.json({ error: 'Minimum contribution is $1.' }, { status: 400 })

    const { data: idea } = await admin
      .from('app_ideas')
      .select('id, title, slug')
      .eq('id', app_idea_id)
      .eq('status', 'built')
      .single()

    if (!idea) return NextResponse.json({ error: 'App not found.' }, { status: 404 })

    // Get or create Stripe customer
    const { data: profile } = await admin.from('users').select('email').eq('id', user.id).single()
    let customerId: string | undefined
    const existing = await stripe.customers.list({ email: profile?.email, limit: 1 })
    if (existing.data.length > 0) {
      customerId = existing.data[0].id
    } else if (profile?.email) {
      const customer = await stripe.customers.create({ email: profile.email })
      customerId = customer.id
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      capture_method: 'automatic',
      payment_method_types: ['card'],
      customer: customerId,
      metadata: { type: 'hosting', user_id: user.id, app_idea_id },
      description: `Hosting contribution for: ${idea.title}`,
    })

    // Insert pending record — webhook updates to captured and increments hosting_collected
    await admin.from('hosting_contributions').insert({
      app_idea_id,
      user_id: user.id,
      amount,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending',
    })

    return NextResponse.json({ success: true, client_secret: paymentIntent.client_secret })
  } catch (err) {
    console.error('Hosting contribute error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
