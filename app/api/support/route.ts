import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

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
    const { amount } = body as { amount: number }

    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Minimum support is $1.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('email').eq('id', user.id).single()
    const email = profile?.email ?? user.email ?? ''

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { user_id: user.id, type: 'support' },
      description: 'Shipdit platform support',
    })

    await admin.from('shipdit_supporters').insert({
      email,
      amount,
      stripe_payment_intent_id: paymentIntent.id,
    })

    return NextResponse.json({ success: true, client_secret: paymentIntent.client_secret })
  } catch (err) {
    console.error('Support route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
