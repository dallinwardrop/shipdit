import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/resend'
import { sendNewIdeaAlert } from '@/lib/emails'
import type { FeatureItem } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      title,
      goal_description,
      features,
      target_user,
      similar_apps,
      platform_preference,
      email,
      submitter_pledge_amount,
    } = body as {
      title: string
      goal_description: string
      features: FeatureItem[]
      target_user: string
      similar_apps: string | null
      platform_preference: string
      email: string
      submitter_pledge_amount: number
    }

    // Validate required fields
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    if (!goal_description?.trim())
      return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
    if (!target_user?.trim())
      return NextResponse.json({ error: 'Target user is required.' }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    if (!submitter_pledge_amount || submitter_pledge_amount < 100)
      return NextResponse.json(
        { error: 'Pledge amount must be at least $1.' },
        { status: 400 }
      )

    const supabase = createAdminClient()

    // Upsert user by email (create if not exists)
    let userId: string

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create auth user (no password — magic link / Google only)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        email_confirm: false,
      })

      if (authError || !authData.user) {
        console.error('Auth user creation error:', authError)
        return NextResponse.json(
          { error: 'Failed to create user account.' },
          { status: 500 }
        )
      }
      userId = authData.user.id

      // Ensure public.users row exists (trigger should fire, but be safe)
      await supabase.from('users').upsert({
        id: userId,
        email: email.trim().toLowerCase(),
      })
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
    const { data: idea, error: ideaError } = await supabase
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
        status: 'submitted',
      })
      .select('id, slug')
      .single()

    if (ideaError || !idea) {
      console.error('Idea insert error:', ideaError)
      // Cancel the payment intent since we failed
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return NextResponse.json({ error: 'Failed to save your idea.' }, { status: 500 })
    }

    // Insert pledge row
    const { error: pledgeError } = await supabase.from('pledges').insert({
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
    console.log('[submit] ADMIN_EMAIL:', process.env.ADMIN_EMAIL)
    sendNewIdeaAlert({
      appTitle: title,
      goalDescription: goal_description,
      targetUser: target_user,
      platform: platform_preference,
      pledgeAmount: submitter_pledge_amount,
      slug: idea.slug ?? '',
    }).catch((err) => console.warn('[submit] Admin alert failed:', err))

    // Send confirmation email (non-fatal if it fails)
    try {
      const resendId = await sendEmail({
        to: email,
        type: 'submission_confirmed',
        ideaTitle: title,
        ideaSlug: idea.slug ?? undefined,
      })

      if (resendId) {
        await supabase.from('email_log').insert({
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
