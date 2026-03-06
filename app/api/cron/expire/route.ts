import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendRefundIssued } from '@/lib/emails'

export const dynamic = 'force-dynamic'

// Scheduled daily at 00:00 UTC via Vercel Cron (Pro plan) or external cron.
// External cron alternative (free): https://cron-job.org — hit GET /api/cron/expire
// with header  Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Ideas that are past deadline AND goal not hit
  const { data: expiredIdeas } = await admin
    .from('app_ideas')
    .select('id, title, slug, build_price, amount_raised')
    .in('status', ['live', 'priced'])
    .lt('funding_deadline', now)
    .or('build_price.is.null,amount_raised.lt.build_price')

  if (!expiredIdeas?.length) {
    return NextResponse.json({ expired: 0, refunded: 0, message: 'Nothing to expire.' })
  }

  let totalRefunded = 0

  for (const idea of expiredIdeas) {
    const { data: pledges } = await admin
      .from('pledges')
      .select('id, stripe_payment_intent_id, user_id, amount')
      .eq('app_idea_id', idea.id)
      .in('status', ['held', 'pending'])

    if (pledges?.length) {
      // Collect user emails in one query
      const userIds = [...new Set(pledges.map((p) => p.user_id))]
      const { data: users } = await admin
        .from('users')
        .select('id, email')
        .in('id', userIds)
      const emailMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.email]))

      // Cancel + refund all pledges in parallel
      await Promise.all(
        pledges.map(async (pledge) => {
          try {
            await stripe.paymentIntents.cancel(pledge.stripe_payment_intent_id)
            await admin
              .from('pledges')
              .update({ status: 'refunded', refunded_at: now })
              .eq('id', pledge.id)
            totalRefunded++

            const email = emailMap[pledge.user_id]
            if (email) {
              sendRefundIssued(email, { appTitle: idea.title, amount: pledge.amount }).catch(console.error)
            }
          } catch (err) {
            console.error(`Failed to refund pledge ${pledge.id}:`, err)
          }
        })
      )
    }

    await admin.from('app_ideas').update({ status: 'expired' }).eq('id', idea.id)
  }

  return NextResponse.json({ expired: expiredIdeas.length, refunded: totalRefunded })
}
