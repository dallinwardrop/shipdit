import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/resend'

// Called nightly by Vercel Cron: GET /api/cron/expire
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find all live ideas past their funding_deadline
  const { data: expiredIdeas } = await admin
    .from('app_ideas')
    .select('id, title, slug')
    .eq('status', 'live')
    .lt('funding_deadline', new Date().toISOString())

  if (!expiredIdeas?.length) {
    return NextResponse.json({ message: 'No expired ideas.', count: 0 })
  }

  let totalRefunded = 0

  for (const idea of expiredIdeas) {
    // Fetch all held/pending pledges for this idea
    const { data: pledges } = await admin
      .from('pledges')
      .select('id, stripe_payment_intent_id, user_id, amount')
      .eq('app_idea_id', idea.id)
      .in('status', ['held', 'pending'])

    if (pledges) {
      for (const pledge of pledges) {
        try {
          await stripe.paymentIntents.cancel(pledge.stripe_payment_intent_id)
          await admin
            .from('pledges')
            .update({ status: 'refunded', refunded_at: new Date().toISOString() })
            .eq('id', pledge.id)
          totalRefunded++

          // Notify user
          const { data: u } = await admin
            .from('users')
            .select('email')
            .eq('id', pledge.user_id)
            .single()

          if (u?.email) {
            await sendEmail({
              to: u.email,
              type: 'refund_issued',
              ideaTitle: idea.title,
              ideaSlug: idea.slug ?? undefined,
              refundAmount: pledge.amount,
            }).catch(console.warn)
          }
        } catch (err) {
          console.error(`Failed to refund pledge ${pledge.id}:`, err)
        }
      }
    }

    // Mark idea as expired
    await admin.from('app_ideas').update({ status: 'expired' }).eq('id', idea.id)
  }

  return NextResponse.json({
    message: 'Expiry cron complete.',
    ideas_expired: expiredIdeas.length,
    pledges_refunded: totalRefunded,
  })
}
