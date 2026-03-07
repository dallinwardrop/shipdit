import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import { sendIdeaBuilding, sendIdeaBuilt } from '@/lib/emails'
import type { IdeaStatus } from '@/lib/supabase/types'

// Valid status transitions for pipeline
const TRANSITIONS: Record<IdeaStatus, IdeaStatus | null> = {
  submitted: 'under_review',
  under_review: 'awaiting_price',
  awaiting_price: 'priced',
  priced: 'live',
  live: null,
  funded: 'building',
  building: 'in_review',
  in_review: 'built',
  built: null,
  rejected: null,
  expired: null,
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const body = await request.json()
    const {
      app_idea_id,
      action,
      build_price,
      build_time_estimate,
      rejection_reason,
      admin_notes,
    } = body as {
      app_idea_id: string
      action: 'advance' | 'reject' | 'set_price'
      build_price?: number
      build_time_estimate?: string
      rejection_reason?: string
      admin_notes?: string
    }

    if (!app_idea_id) return NextResponse.json({ error: 'app_idea_id required.' }, { status: 400 })

    const { data: idea } = await admin
      .from('app_ideas')
      .select('id, title, slug, status, submitter_id, demo_url')
      .eq('id', app_idea_id)
      .single()

    if (!idea) return NextResponse.json({ error: 'Idea not found.' }, { status: 404 })

    if (action === 'reject') {
      await admin
        .from('app_ideas')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason ?? null,
          admin_notes: admin_notes ?? null,
        })
        .eq('id', app_idea_id)

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    if (action === 'set_price') {
      if (!build_price || build_price < 100) {
        return NextResponse.json({ error: 'Valid build_price required (in cents).' }, { status: 400 })
      }

      await admin
        .from('app_ideas')
        .update({
          status: 'priced',
          build_price,
          build_time_estimate: build_time_estimate ?? null,
          priced_at: new Date().toISOString(),
          admin_notes: admin_notes ?? null,
        })
        .eq('id', app_idea_id)

      return NextResponse.json({ success: true, status: 'priced' })
    }

    if (action === 'advance') {
      const nextStatus = TRANSITIONS[idea.status as IdeaStatus]
      if (!nextStatus) {
        return NextResponse.json(
          { error: `No valid transition from status: ${idea.status}` },
          { status: 400 }
        )
      }

      const updatePayload: Record<string, unknown> = {
        status: nextStatus,
        admin_notes: admin_notes ?? null,
      }

      if (nextStatus === 'awaiting_price' || nextStatus === 'under_review') {
        updatePayload.approved_at = new Date().toISOString()
      }

      // live_at and funding_deadline are set by the DB trigger

      await admin.from('app_ideas').update(updatePayload).eq('id', app_idea_id)

      // Notify submitter on key transitions
      const { data: submitter } = await admin
        .from('users')
        .select('email')
        .eq('id', idea.submitter_id)
        .single()

      if (submitter?.email) {
        if (nextStatus === 'awaiting_price' || nextStatus === 'under_review') {
          await sendEmail({
            to: submitter.email,
            type: 'idea_approved',
            ideaTitle: idea.title,
          }).catch(console.warn)
        }
        if (nextStatus === 'live') {
          await sendEmail({
            to: submitter.email,
            type: 'idea_live',
            ideaTitle: idea.title,
            ideaSlug: idea.slug ?? undefined,
          }).catch(console.warn)
        }
      }

      // Notify all backers on key build milestones (non-blocking)
      if ((nextStatus === 'building' || nextStatus === 'built') && idea.slug) {
        ;(async () => {
          const { data: pledgeRows } = await admin
            .from('pledges')
            .select('user_id')
            .eq('app_idea_id', app_idea_id)
            .eq('type', 'pledge')
            .in('status', ['held', 'captured'])

          const uniqueUserIds = [...new Set((pledgeRows ?? []).map((p) => p.user_id))]
          if (!uniqueUserIds.length) return

          const { data: backers } = await admin
            .from('users')
            .select('id, email')
            .in('id', uniqueUserIds)

          for (const backer of backers ?? []) {
            if (!backer.email) continue

            let resendId: string | null = null
            let subject = ''
            let emailType: 'idea_building' | 'idea_built'

            if (nextStatus === 'building') {
              subject = `🔨 ${idea.title} is being built!`
              emailType = 'idea_building'
              resendId = await sendIdeaBuilding(backer.email, { appTitle: idea.title, slug: idea.slug! })
            } else {
              subject = `🚀 ${idea.title} is live!`
              emailType = 'idea_built'
              resendId = await sendIdeaBuilt(backer.email, {
                appTitle: idea.title,
                slug: idea.slug!,
                appUrl: idea.demo_url ?? null,
              })
            }

            await admin.from('email_log').insert({
              to_user_id: backer.id,
              to_email: backer.email,
              subject,
              type: emailType,
              app_idea_id: idea.id,
              resend_id: resendId,
            })
          }
        })().catch((err) => console.warn('[approve] Backer email failed:', err))
      }

      return NextResponse.json({ success: true, status: nextStatus })
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  } catch (err) {
    console.error('Approve route error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
