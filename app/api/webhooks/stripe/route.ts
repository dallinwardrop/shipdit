import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'
import { sendGoalHit, sendRefundIssued, sendSupportThankYou } from '@/lib/emails'

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
      const { data: heldPledges } = await admin
        .from('pledges')
        .update({ status: 'held', stripe_customer_id: pi.customer as string | null })
        .eq('stripe_payment_intent_id', pi.id)
        .select('app_idea_id, amount')

      // Auto-capture if this pledge pushed the idea over its funding goal
      const pledge = heldPledges?.[0]
      if (pledge) {
        const { data: idea } = await admin
          .from('app_ideas')
          .select('id, title, slug, build_price, amount_raised, status')
          .eq('id', pledge.app_idea_id)
          .single()

        if (
          idea &&
          idea.status === 'live' &&
          idea.build_price != null &&
          idea.amount_raised >= idea.build_price
        ) {
          // Atomically claim the funding transition (only one webhook wins)
          const { data: claimed } = await admin
            .from('app_ideas')
            .update({ status: 'funded' })
            .eq('id', idea.id)
            .eq('status', 'live') // guard: only proceeds if still live
            .select('id')

          if (claimed && claimed.length > 0) {
            // This is the winning webhook — capture all held pledges
            const { data: allHeld } = await admin
              .from('pledges')
              .select('id, amount, stripe_payment_intent_id, user_id')
              .eq('app_idea_id', idea.id)
              .eq('status', 'held')

            await Promise.all(
              (allHeld ?? []).map(async (p) => {
                try {
                  await stripe.paymentIntents.capture(p.stripe_payment_intent_id)
                  await admin
                    .from('pledges')
                    .update({ status: 'captured', captured_at: new Date().toISOString() })
                    .eq('id', p.id)
                } catch (err) {
                  console.error(`Auto-capture failed for pledge ${p.id}:`, err)
                  await admin.from('pledges').update({ status: 'failed' }).eq('id', p.id)
                }
              })
            )

            // Email all backers
            const backerIds = (allHeld ?? []).map((p) => p.user_id)
            if (backerIds.length > 0) {
              const { data: backers } = await admin
                .from('users')
                .select('id, email')
                .in('id', backerIds)

              ;(allHeld ?? []).forEach((p) => {
                const backer = backers?.find((b) => b.id === p.user_id)
                if (backer?.email) {
                  sendGoalHit(backer.email, { appTitle: idea.title, amount: p.amount }).catch(console.error)
                }
              })
            }
          }
        }
      }
      break
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent

      if (pi.metadata?.type === 'hosting') {
        // Mark hosting contribution as captured
        await admin
          .from('hosting_contributions')
          .update({ status: 'captured' })
          .eq('stripe_payment_intent_id', pi.id)

        // Increment hosting_collected on the idea
        const appIdeaId = pi.metadata.app_idea_id
        if (appIdeaId) {
          const { data: idea } = await admin
            .from('app_ideas')
            .select('hosting_collected')
            .eq('id', appIdeaId)
            .single()
          if (idea != null) {
            await admin
              .from('app_ideas')
              .update({ hosting_collected: (idea.hosting_collected ?? 0) + pi.amount })
              .eq('id', appIdeaId)
          }
        }
      } else if (pi.metadata?.type === 'support') {
        // Mark supporter record as captured and send thank you email
        await admin
          .from('shipdit_supporters')
          .update({ status: 'captured' })
          .eq('stripe_payment_intent_id', pi.id)

        const userId = pi.metadata.user_id
        if (userId) {
          const { data: supporter } = await admin
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()
          if (supporter?.email) {
            sendSupportThankYou(supporter.email, { amount: pi.amount }).catch(console.error)
          }
        }
      } else {
        // Update pledge status
        const { data: updatedPledges } = await admin
          .from('pledges')
          .update({ status: 'captured', captured_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', pi.id)
          .select('user_id, amount, app_idea_id')

        // Email the backer — their card was just charged
        const pledge = updatedPledges?.[0]
        if (pledge) {
          const [{ data: idea }, { data: backer }] = await Promise.all([
            admin.from('app_ideas').select('title').eq('id', pledge.app_idea_id).single(),
            admin.from('users').select('email').eq('id', pledge.user_id).single(),
          ])
          if (idea && backer?.email) {
            sendGoalHit(backer.email, { appTitle: idea.title, amount: pledge.amount }).catch(console.error)
          }
        }
      }
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
        const { data: refundedPledges } = await admin
          .from('pledges')
          .update({ status: 'refunded', refunded_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', charge.payment_intent as string)
          .select('user_id, amount, app_idea_id')

        const pledge = refundedPledges?.[0]
        if (pledge) {
          const [{ data: idea }, { data: backer }] = await Promise.all([
            admin.from('app_ideas').select('title').eq('id', pledge.app_idea_id).single(),
            admin.from('users').select('email').eq('id', pledge.user_id).single(),
          ])
          if (idea && backer?.email) {
            sendRefundIssued(backer.email, { appTitle: idea.title, amount: pledge.amount }).catch(console.error)
          }
        }
      }
      break
    }

    default:
      // Unhandled event type — ignore
      break
  }

  return NextResponse.json({ received: true })
}
