import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendIdeaFunded } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const body = await request.json()
    // Accept either idea_id or legacy app_idea_id
    const ideaId: string = body.idea_id ?? body.app_idea_id
    if (!ideaId) return NextResponse.json({ error: 'idea_id required.' }, { status: 400 })

    const { data: idea } = await admin
      .from('app_ideas')
      .select('id, title, slug, status, build_price, amount_raised, submitter_id')
      .eq('id', ideaId)
      .single()

    if (!idea) return NextResponse.json({ error: 'Idea not found.' }, { status: 404 })
    if (!['live', 'funded'].includes(idea.status))
      return NextResponse.json({ error: 'Idea must be live or funded to capture pledges.' }, { status: 400 })

    // Fetch all held pledges
    const { data: pledges } = await admin
      .from('pledges')
      .select('id, amount, stripe_payment_intent_id, user_id')
      .eq('app_idea_id', ideaId)
      .eq('status', 'held')

    if (!pledges?.length)
      return NextResponse.json({ error: 'No held pledges to capture.' }, { status: 400 })

    const results = { captured: 0, failed: 0 }

    await Promise.all(
      pledges.map(async (pledge) => {
        try {
          await stripe.paymentIntents.capture(pledge.stripe_payment_intent_id)
          await admin
            .from('pledges')
            .update({ status: 'captured', captured_at: new Date().toISOString() })
            .eq('id', pledge.id)
          results.captured++
        } catch (err) {
          console.error(`Failed to capture pledge ${pledge.id}:`, err)
          await admin.from('pledges').update({ status: 'failed' }).eq('id', pledge.id)
          results.failed++
        }
      })
    )

    // Mark idea as funded
    await admin
      .from('app_ideas')
      .update({ status: 'funded' })
      .eq('id', ideaId)

    // Email all backers and log (non-blocking)
    if (idea.slug) {
      const capturedUserIds = [...new Set(pledges.map((p) => p.user_id))]
      const { data: backers } = await admin
        .from('users')
        .select('id, email')
        .in('id', capturedUserIds)

      const subject = `🎉 ${idea.title} is fully funded!`
      ;(async () => {
        for (const backer of backers ?? []) {
          if (!backer.email) continue
          const resendId = await sendIdeaFunded(backer.email, { appTitle: idea.title, slug: idea.slug! })
          await admin.from('email_log').insert({
            to_user_id: backer.id,
            to_email: backer.email,
            subject,
            type: 'idea_funded',
            app_idea_id: idea.id,
            resend_id: resendId,
          })
        }
      })().catch((err) => console.warn('[capture] Backer email failed:', err))
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error('Capture route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
