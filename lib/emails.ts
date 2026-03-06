import { resend } from './resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shipdit.co'
const FROM = 'Shipdit <noreply@shipdit.co>'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function layout(body: string, cta?: { text: string; url: string }): string {
  const ctaHtml = cta
    ? `<p style="margin:28px 0 0;">
        <a href="${cta.url}"
           style="display:inline-block;background:#000080;color:#ffffff;padding:12px 24px;
                  text-decoration:none;font-weight:bold;font-family:monospace;font-size:14px;
                  border:2px solid #000040;">
          ${cta.text}
        </a>
       </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table cellpadding="0" cellspacing="0"
               style="width:100%;max-width:580px;background:#ffffff;border:2px solid #808080;">

          <!-- Header -->
          <tr>
            <td style="background:#000080;padding:20px 28px;">
              <span style="font-family:monospace;font-size:26px;font-weight:bold;
                           color:#ffffff;letter-spacing:3px;">SHIPDIT</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px;color:#1a1a1a;font-size:15px;line-height:1.7;">
              ${body}
              ${ctaHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f4;padding:16px 28px;border-top:2px solid #c0c0c0;">
              <p style="margin:0;font-size:12px;color:#606060;font-family:monospace;">
                <a href="${APP_URL}" style="color:#000080;text-decoration:none;">Shipdit.co</a>
                &nbsp;—&nbsp;Community funded apps<br>
                You&rsquo;re receiving this because you have an account or pledge on Shipdit.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) console.error('[emails] Resend error:', error)
  } catch (err) {
    console.error('[emails] Send failed:', err)
  }
}

// ── Email functions ───────────────────────────────────────────────────────────

export async function sendPledgeConfirmation(
  to: string,
  { appTitle, amount, fundingDeadline, slug }: {
    appTitle: string
    amount: number
    fundingDeadline: string
    slug: string
  }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">Your pledge is confirmed ✓</h2>
     <p>Your card has been <strong>authorized for ${dollars(amount)}</strong>
        toward <strong>${appTitle}</strong>.</p>
     <p>Your card is <strong>not charged yet</strong>. It will only be charged if the
        full funding goal is reached by <strong>${fmtDate(fundingDeadline)}</strong>.
        If the goal isn&rsquo;t hit, the hold is automatically released and you owe nothing.</p>
     <p>We&rsquo;ll email you when the project is funded and when it ships.</p>`,
    { text: 'View the project →', url: `${APP_URL}/fund/${slug}` }
  )
  await send(to, `Your pledge to fund "${appTitle}" is confirmed`, html)
}

export async function sendIdeaApproved(
  to: string,
  { appTitle, slug }: { appTitle: string; slug: string }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">Your idea is approved and live on Shipdit 🎉</h2>
     <p>Great news — <strong>${appTitle}</strong> has passed review and is now live in the
        public funding queue.</p>
     <p>The more people who see it, the faster it gets funded. Share your link with friends,
        communities, and anyone who&rsquo;d benefit from this app.</p>
     <p>You&rsquo;ll receive updates as pledges come in and when the goal is hit.</p>`,
    { text: 'View your idea →', url: `${APP_URL}/fund/${slug}` }
  )
  await send(to, `Your idea is approved and live on Shipdit`, html)
}

export async function sendIdeaRejected(
  to: string,
  { appTitle, rejectionReason }: { appTitle: string; rejectionReason?: string | null }
): Promise<void> {
  const reasonBlock = rejectionReason
    ? `<p><strong>Reason:</strong> ${rejectionReason}</p>`
    : ''
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">Update on your Shipdit submission</h2>
     <p>Thanks for submitting <strong>${appTitle}</strong> to Shipdit.</p>
     <p>After review, we weren&rsquo;t able to approve this one for the public queue.</p>
     ${reasonBlock}
     <p>This doesn&rsquo;t mean it&rsquo;s a bad idea — sometimes the timing, scope, or
        feasibility isn&rsquo;t quite right. We encourage you to refine and resubmit, or
        bring a new idea.</p>`,
    { text: 'Submit another idea →', url: `${APP_URL}/submit` }
  )
  await send(to, `Update on your Shipdit submission`, html)
}

export async function sendGoalHit(
  to: string,
  { appTitle, amount }: { appTitle: string; amount: number }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">🚀 ${appTitle} is fully funded!</h2>
     <p>The funding goal was reached. Your card has been charged
        <strong>${dollars(amount)}</strong>.</p>
     <p>Building starts now. You&rsquo;ll receive progress updates as the app takes shape,
        and a final notification when it goes live — free for everyone.</p>
     <p>Thank you for making this happen.</p>`,
    { text: 'See the project →', url: APP_URL }
  )
  await send(to, `🚀 ${appTitle} is fully funded!`, html)
}

export async function sendIdeaLive(
  to: string,
  { appTitle, slug, buildPrice, fundingDeadline }: {
    appTitle: string
    slug: string
    buildPrice: number
    fundingDeadline: string
  }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">${appTitle} is now open for funding</h2>
     <p>The build price has been set at <strong>${dollars(buildPrice)}</strong> and the
        idea is now live in the public funding queue.</p>
     <p>Funding closes <strong>${fmtDate(fundingDeadline)}</strong>. If the goal is reached,
        building starts immediately. If not, all pledges are fully refunded.</p>
     <p>Share the link to help push it over the line.</p>`,
    { text: 'Back this app →', url: `${APP_URL}/fund/${slug}` }
  )
  await send(to, `${appTitle} is now open for funding`, html)
}

export async function sendHostingReminder(
  to: string,
  { appTitle, slug, amountNeeded, daysLeft }: {
    appTitle: string
    slug: string
    amountNeeded: number
    daysLeft: number
  }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">Help keep ${appTitle} online</h2>
     <p>The hosting for <strong>${appTitle}</strong> is coming up for renewal in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
     <p>We still need <strong>${dollars(amountNeeded)}</strong> to cover this month's hosting and keep the app free for everyone.</p>
     <p>As a backer who helped fund this app, your contribution keeps it running. Every dollar helps.</p>`,
    { text: 'Contribute to hosting →', url: `${APP_URL}/hosting/${slug}` }
  )
  await send(to, `Help keep ${appTitle} online — hosting renewal needed`, html)
}

export async function sendHostingOffline(
  to: string,
  { appTitle, slug }: { appTitle: string; slug: string }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#cc0000;">${appTitle} has gone offline</h2>
     <p>Unfortunately, <strong>${appTitle}</strong> has been taken offline due to unpaid hosting costs.</p>
     <p>You can help bring it back by contributing to hosting. Once enough funding is collected, the app will come back online free for everyone.</p>`,
    { text: 'Help bring it back →', url: `${APP_URL}/hosting/${slug}` }
  )
  await send(to, `${appTitle} has gone offline — help bring it back`, html)
}

export async function sendHostingFunded(
  to: string,
  { appTitle, slug, totalCollected }: {
    appTitle: string
    slug: string
    totalCollected: number
  }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">✓ Hosting funded for ${appTitle}</h2>
     <p>Thanks to community contributions, <strong>${appTitle}</strong> is fully funded for another month.</p>
     <p>A total of <strong>${dollars(totalCollected)}</strong> was collected this period. The app will stay free for everyone.</p>
     <p>Thank you for keeping this community-funded project alive.</p>`,
    { text: 'View the app →', url: `${APP_URL}/hosting/${slug}` }
  )
  await send(to, `✓ Hosting funded for ${appTitle} — thank you!`, html)
}

export async function sendRefundIssued(
  to: string,
  { appTitle, amount }: { appTitle: string; amount: number }
): Promise<void> {
  const html = layout(
    `<h2 style="margin-top:0;color:#000080;">Your Shipdit pledge has been refunded</h2>
     <p>The funding goal for <strong>${appTitle}</strong> wasn&rsquo;t reached in time.</p>
     <p>Your <strong>${dollars(amount)}</strong> hold has been released.
        No charge was ever made to your card.</p>
     <p>We hope you&rsquo;ll back another idea — there are always new ones in the queue.</p>`,
    { text: 'Browse the queue →', url: APP_URL }
  )
  await send(to, `Your Shipdit pledge has been refunded`, html)
}
