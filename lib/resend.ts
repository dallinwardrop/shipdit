import { Resend } from 'resend'
import type { EmailType } from '@/lib/supabase/types'

if (!process.env.RESEND_API_KEY) {
  throw new Error('Missing RESEND_API_KEY environment variable')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const FROM_ADDRESS = 'Shipdit <hello@shipdit.co>'
const REPLY_TO = 'dallin@shipdit.co'

export type EmailPayload = {
  to: string
  type: EmailType
  ideaTitle?: string
  ideaSlug?: string
  refundAmount?: number
  updateBody?: string
  demoUrl?: string
  hostingExpiresAt?: string
}

export async function sendEmail(payload: EmailPayload): Promise<string | null> {
  const { to, type, ideaTitle, ideaSlug, refundAmount, updateBody, demoUrl, hostingExpiresAt } =
    payload

  const ideaUrl = ideaSlug ? `${APP_URL}/fund/${ideaSlug}` : APP_URL

  const templates: Record<EmailType, { subject: string; html: string }> = {
    submission_confirmed: {
      subject: `Your idea "${ideaTitle}" has been received — Shipdit`,
      html: `<h1>We got it!</h1>
<p>Thanks for submitting <strong>${ideaTitle}</strong>. We'll review it and reach out when it moves forward.</p>
<p><a href="${APP_URL}/submit">Submit another idea</a></p>`,
    },
    idea_approved: {
      subject: `"${ideaTitle}" has been approved — Shipdit`,
      html: `<h1>Your idea is approved!</h1>
<p><strong>${ideaTitle}</strong> has passed review. We're now pricing it out — you'll hear from us soon.</p>`,
    },
    idea_live: {
      subject: `"${ideaTitle}" is now live for funding — Shipdit`,
      html: `<h1>It's live!</h1>
<p><strong>${ideaTitle}</strong> is now open for community funding. Share your link to help it reach goal.</p>
<p><a href="${ideaUrl}">View your idea</a></p>`,
    },
    goal_hit: {
      subject: `"${ideaTitle}" hit its funding goal! — Shipdit`,
      html: `<h1>Goal reached!</h1>
<p><strong>${ideaTitle}</strong> has been fully funded. We'll start building soon and keep you posted.</p>
<p><a href="${ideaUrl}">See the project</a></p>`,
    },
    backer_update: {
      subject: `Update on "${ideaTitle}" — Shipdit`,
      html: `<h1>Build Update</h1>
<p>${updateBody ?? ''}</p>
${demoUrl ? `<p><a href="${demoUrl}">View Demo</a></p>` : ''}
<p><a href="${ideaUrl}">See the project</a></p>`,
    },
    hosting_warning: {
      subject: `Hosting for "${ideaTitle}" expires soon — Shipdit`,
      html: `<h1>Hosting expiring soon</h1>
<p>The free hosting for <strong>${ideaTitle}</strong> expires on ${hostingExpiresAt ?? 'soon'}. Donate to keep it online.</p>
<p><a href="${ideaUrl}">Keep it alive</a></p>`,
    },
    hosting_expired: {
      subject: `"${ideaTitle}" has gone offline — Shipdit`,
      html: `<h1>App offline</h1>
<p><strong>${ideaTitle}</strong> has gone offline due to expired hosting. Donate to bring it back.</p>`,
    },
    idea_funded: {
      subject: `"${ideaTitle}" is fully funded! — Shipdit`,
      html: `<h1>Fully funded!</h1><p><strong>${ideaTitle}</strong> hit its goal. The build is starting soon.</p>`,
    },
    idea_building: {
      subject: `"${ideaTitle}" is being built! — Shipdit`,
      html: `<h1>Build in progress!</h1><p>Work has started on <strong>${ideaTitle}</strong>. Stay tuned for updates.</p>`,
    },
    idea_built: {
      subject: `"${ideaTitle}" is live! — Shipdit`,
      html: `<h1>It's live!</h1><p><strong>${ideaTitle}</strong> is done and free for everyone to use.</p>${ideaSlug ? `<p><a href="${ideaUrl}">View the app</a></p>` : ''}`,
    },
    refund_issued: {
      subject: `Your pledge for "${ideaTitle}" has been refunded — Shipdit`,
      html: `<h1>Refund issued</h1>
<p>Your pledge of <strong>$${((refundAmount ?? 0) / 100).toFixed(2)}</strong> for <strong>${ideaTitle}</strong> has been refunded. It may take 5–10 business days to appear.</p>`,
    },
  }

  const { subject, html } = templates[type]

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      replyTo: REPLY_TO,
    })

    if (error) {
      console.error('Resend error:', error)
      return null
    }

    return data?.id ?? null
  } catch (err) {
    console.error('Failed to send email:', err)
    return null
  }
}
