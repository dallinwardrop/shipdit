import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { pledge_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { pledge_id } = body
  if (!pledge_id) return NextResponse.json({ error: 'pledge_id required.' }, { status: 400 })

  // ── Fetch pledge ────────────────────────────────────────────────────────────
  const { data: pledge, error: fetchError } = await admin
    .from('pledges')
    .select('id, status, stripe_payment_intent_id')
    .eq('id', pledge_id)
    .single()

  if (fetchError || !pledge) {
    return NextResponse.json({ error: 'Pledge not found.' }, { status: 404 })
  }

  if (pledge.status !== 'authorized') {
    return NextResponse.json({ error: `Pledge is not in authorized status (current: ${pledge.status}).` }, { status: 400 })
  }

  if (!pledge.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No Stripe payment intent on this pledge.' }, { status: 400 })
  }

  // ── Capture via Stripe ──────────────────────────────────────────────────────
  try {
    await stripe.paymentIntents.capture(pledge.stripe_payment_intent_id)
  } catch (err) {
    const msg = (err as Error).message
    console.error('[capture-pledge] Stripe capture failed:', msg)
    return NextResponse.json({ error: `Stripe capture failed: ${msg}` }, { status: 502 })
  }

  // ── Update pledge status ────────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('pledges')
    .update({ status: 'captured', captured_at: new Date().toISOString() })
    .eq('id', pledge_id)

  if (updateError) {
    console.error('[capture-pledge] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Stripe capture succeeded but DB update failed.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
