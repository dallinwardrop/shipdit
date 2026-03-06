import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

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

    // Fetch active pledges that have a Stripe PaymentIntent to cancel
    const { data: activePledges } = await admin
      .from('pledges')
      .select('id, stripe_payment_intent_id')
      .eq('app_idea_id', idea_id)
      .in('status', ['pending', 'held'])

    // Cancel each PaymentIntent in Stripe
    const cancelResults = await Promise.allSettled(
      (activePledges ?? [])
        .filter((p) => p.stripe_payment_intent_id)
        .map((p) => stripe.paymentIntents.cancel(p.stripe_payment_intent_id))
    )

    // Log any Stripe cancellation failures but don't block deletion
    cancelResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`Failed to cancel PaymentIntent for pledge ${activePledges![i].id}:`, result.reason)
      }
    })

    // Delete all pledges for this idea
    const { error: pledgeDeleteError } = await admin
      .from('pledges')
      .delete()
      .eq('app_idea_id', idea_id)

    if (pledgeDeleteError) {
      console.error('Pledge delete error:', pledgeDeleteError)
      return NextResponse.json({ error: 'Failed to delete pledges.' }, { status: 500 })
    }

    // Delete the idea
    const { error: ideaDeleteError } = await admin
      .from('app_ideas')
      .delete()
      .eq('id', idea_id)

    if (ideaDeleteError) {
      console.error('Idea delete error:', ideaDeleteError)
      return NextResponse.json({ error: 'Failed to delete idea.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/delete error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
