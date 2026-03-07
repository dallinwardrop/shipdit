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

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { pledge_id } = await request.json() as { pledge_id: string }
    if (!pledge_id) return NextResponse.json({ error: 'pledge_id required.' }, { status: 400 })

    // Fetch the pledge with related idea and user
    const { data: pledge } = await admin
      .from('pledges')
      .select('id, status, stripe_payment_intent_id, user_id, app_idea_id, app_ideas(title, slug), users(email)')
      .eq('id', pledge_id)
      .single()

    if (!pledge) return NextResponse.json({ error: 'Pledge not found.' }, { status: 404 })
    if (pledge.status !== 'held') {
      return NextResponse.json({ error: 'Only held pledges can be released.' }, { status: 400 })
    }

    // Cancel the Stripe payment intent
    await stripe.paymentIntents.cancel(pledge.stripe_payment_intent_id)

    // Mark pledge as cancelled
    const { error: updateError } = await admin
      .from('pledges')
      .update({ status: 'cancelled' })
      .eq('id', pledge_id)

    if (updateError) throw updateError

    // Send email and log (non-blocking)
    const idea = (pledge.app_ideas as unknown) as { title: string; slug: string | null } | null
    const backerUser = (pledge.users as unknown) as { email: string } | null

    if (idea && backerUser?.email) {
      const subject = `Your pledge for "${idea.title}" has been released`
      ;(async () => {
        const resendId = await sendPledgeReleased(backerUser.email, {
          appTitle: idea.title,
          slug: idea.slug,
        })
        await admin.from('email_log').insert({
          to_user_id: pledge.user_id,
          to_email: backerUser.email,
          subject,
          type: 'pledge_released',
          app_idea_id: pledge.app_idea_id,
          resend_id: resendId,
        })
      })().catch((err) => console.warn('[release-pledge] Email failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/release-pledge error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
