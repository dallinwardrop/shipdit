import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: { idea_id?: string }
    try {
      body = await request.json()
    } catch (e) {
      console.error('[delete] Failed to parse request body:', e)
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const { idea_id } = body
    console.log('[delete] idea_id received:', idea_id)
    if (!idea_id) return NextResponse.json({ error: 'idea_id required.' }, { status: 400 })

    // ── Verify idea exists ────────────────────────────────────────────────────
    const { data: idea, error: ideaFetchError } = await admin
      .from('app_ideas')
      .select('id, title')
      .eq('id', idea_id)
      .single()

    if (ideaFetchError || !idea) {
      console.error('[delete] Idea not found:', ideaFetchError)
      return NextResponse.json({ error: 'Idea not found.' }, { status: 404 })
    }
    console.log('[delete] Deleting idea:', idea.title)

    // ── Cancel active Stripe PaymentIntents ───────────────────────────────────
    const { data: activePledges, error: pledgeFetchError } = await admin
      .from('pledges')
      .select('id, stripe_payment_intent_id, status')
      .eq('app_idea_id', idea_id)
      .in('status', ['pending', 'held'])

    if (pledgeFetchError) {
      console.error('[delete] Failed to fetch pledges:', pledgeFetchError)
    }

    console.log('[delete] Active pledges to cancel:', activePledges?.length ?? 0)

    const cancelResults = await Promise.allSettled(
      (activePledges ?? [])
        .filter((p) => p.stripe_payment_intent_id)
        .map(async (p) => {
          try {
            await stripe.paymentIntents.cancel(p.stripe_payment_intent_id)
            console.log('[delete] Cancelled PI:', p.stripe_payment_intent_id)
          } catch (err) {
            // Already cancelled/captured PIs throw — log and continue
            console.warn('[delete] Stripe cancel skipped for', p.stripe_payment_intent_id, ':', (err as Error).message)
          }
        })
    )
    console.log('[delete] Stripe cancellations done:', cancelResults.length)

    // ── Delete child rows in FK order ─────────────────────────────────────────

    // hosting_contributions (has ON DELETE CASCADE but delete explicitly for safety)
    const { error: hcErr } = await admin.from('hosting_contributions').delete().eq('app_idea_id', idea_id)
    if (hcErr) console.warn('[delete] hosting_contributions delete:', hcErr.message)

    // pledges
    const { error: pledgeDeleteError } = await admin.from('pledges').delete().eq('app_idea_id', idea_id)
    if (pledgeDeleteError) {
      console.error('[delete] Pledge delete failed:', JSON.stringify(pledgeDeleteError))
      return NextResponse.json({ error: `Failed to delete pledges: ${pledgeDeleteError.message}` }, { status: 500 })
    }
    console.log('[delete] Pledges deleted')

    // referrals
    const { error: refErr } = await admin.from('referrals').delete().eq('app_idea_id', idea_id)
    if (refErr) console.warn('[delete] referrals delete:', refErr.message)
    else console.log('[delete] Referrals deleted')

    // backer_updates
    const { error: buErr } = await admin.from('backer_updates').delete().eq('app_idea_id', idea_id)
    if (buErr) console.warn('[delete] backer_updates delete:', buErr.message)
    else console.log('[delete] Backer updates deleted')

    // email_log
    const { error: elErr } = await admin.from('email_log').delete().eq('app_idea_id', idea_id)
    if (elErr) console.warn('[delete] email_log delete:', elErr.message)
    else console.log('[delete] Email log deleted')

    // live_apps
    const { error: laErr } = await admin.from('live_apps').delete().eq('app_idea_id', idea_id)
    if (laErr) console.warn('[delete] live_apps delete:', laErr.message)
    else console.log('[delete] Live apps deleted')

    // ── Delete the idea row ───────────────────────────────────────────────────
    const { error: ideaDeleteError } = await admin.from('app_ideas').delete().eq('id', idea_id)
    if (ideaDeleteError) {
      console.error('[delete] Idea delete failed:', JSON.stringify(ideaDeleteError))
      return NextResponse.json({ error: `Failed to delete idea: ${ideaDeleteError.message}` }, { status: 500 })
    }

    console.log('[delete] Success — idea deleted:', idea_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete] Unhandled error:', err)
    return NextResponse.json({ error: `Internal server error: ${(err as Error).message}` }, { status: 500 })
  }
}
