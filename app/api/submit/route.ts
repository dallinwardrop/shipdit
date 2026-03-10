import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/resend'
import { sendNewIdeaAlert } from '@/lib/emails'
import type { FeatureItem } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    // ── Require authentication ──────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json()

    const {
      title,
      goal_description,
      features,
      target_user,
      similar_apps,
      platform_preference,
      submitter_pledge_amount,
    } = body as {
      title: string
      goal_description: string
      features: FeatureItem[]
      target_user: string
      similar_apps: string | null
      platform_preference: string
      submitter_pledge_amount: number
    }

    // Validate required fields
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    if (!goal_description?.trim())
      return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
    if (!target_user?.trim())
      return NextResponse.json({ error: 'Target user is required.' }, { status: 400 })
    if (!submitter_pledge_amount || submitter_pledge_amount < 100)
      return NextResponse.json(
        { error: 'Pledge amount must be at least $1.' },
        { status: 400 }
      )

    const mustHaves = (features ?? []).filter(
      (f: FeatureItem) => f.priority === 'MUST HAVE' && f.text?.trim()
    )
    if (mustHaves.length < 1)
      return NextResponse.json(
        { error: 'At least 1 must-have feature is required.' },
        { status: 400 }
      )
    if (mustHaves.length > 3)
      return NextResponse.json(
        { error: 'Maximum 3 must-have features allowed.' },
        { status: 400 }
      )

    const admin = createAdminClient()
    const userId = user.id

    // Get email from the users table (authoritative source for notifications).
    // Fall back to auth user email if the row hasn't been created yet by trigger.
    const { data: profile } = await admin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()
    const email = profile?.email ?? user.email ?? ''

    // Ensure the public.users row exists (trigger should fire, but be safe)
    if (!profile) {
      await admin.from('users').upsert({ id: userId, email })
    }

    // Create Stripe Payment Intent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: submitter_pledge_amount,
      currency: 'usd',
      capture_method: 'manual',
      payment_method_types: ['card'],
      metadata: {
        user_id: userId,
        email,
        title,
        is_submitter_pledge: 'true',
      },
      description: `Submitter pledge for: ${title}`,
    })

    // Insert app_ideas row
    const { data: idea, error: ideaError } = await admin
      .from('app_ideas')
      .insert({
        submitter_id: userId,
        title: title.trim(),
        goal_description: goal_description.trim(),
        features: features ?? [],
        target_user: target_user.trim(),
        similar_apps: similar_apps?.trim() || null,
        platform_preference: platform_preference || 'web',
        submitter_pledge_amount,
        status: 'under_review',
      })
      .select('id, slug')
      .single()

    if (ideaError || !idea) {
      console.error('Idea insert error:', ideaError)
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return NextResponse.json({ error: 'Failed to save your idea.' }, { status: 500 })
    }

    // Insert pledge row
    const { error: pledgeError } = await admin.from('pledges').insert({
      user_id: userId,
      app_idea_id: idea.id,
      amount: submitter_pledge_amount,
      type: 'pledge',
      status: 'held',
      stripe_payment_intent_id: paymentIntent.id,
      is_submitter_pledge: true,
    })

    if (pledgeError) {
      console.error('Pledge insert error:', pledgeError)
      // Non-fatal — idea is saved, PI exists. Log but continue.
    }

    // Notify admin of new submission (non-fatal)
    sendNewIdeaAlert({
      appTitle: title,
      goalDescription: goal_description,
      targetUser: target_user,
      platform: platform_preference,
      pledgeAmount: submitter_pledge_amount,
      slug: idea.slug ?? '',
    }).catch((err) => console.warn('[submit] Admin alert failed:', err))

    // Send confirmation email to the authenticated user's account email (non-fatal)
    try {
      const resendId = await sendEmail({
        to: email,
        type: 'submission_confirmed',
        ideaTitle: title,
        ideaSlug: idea.slug ?? undefined,
      })

      if (resendId) {
        await admin.from('email_log').insert({
          to_user_id: userId,
          to_email: email,
          subject: `Your idea "${title}" has been received`,
          type: 'submission_confirmed',
          app_idea_id: idea.id,
          resend_id: resendId,
        })
      }
    } catch (emailErr) {
      console.warn('Email send failed (non-fatal):', emailErr)
    }

    return NextResponse.json({
      success: true,
      slug: idea.slug,
      idea_id: idea.id,
      payment_intent_client_secret: paymentIntent.client_secret,
    })
  } catch (err) {
    console.error('Submit route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
