import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Shipdit',
}

const SECTIONS = [
  {
    title: '1. Who We Are',
    body: `Shipdit ("we", "us", "our") is a community-funded app-building platform operated as a sole proprietorship. This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data.

If you have questions, contact us at dallin@shipdit.co.`,
  },
  {
    title: '2. Data We Collect',
    body: `Email address — collected when you submit an idea, create an account, or pledge to a project. Used to send you notifications about your pledges, idea status updates, and platform announcements.

Name — optionally collected from your OAuth provider (Google) if you sign in that way. Displayed on your public backer profile if you do not pledge anonymously.

Payment metadata — when you pledge or contribute to hosting, Stripe processes your payment. Shipdit receives limited metadata from Stripe: payment intent ID, last four digits of your card, card brand, and charge status. We do not receive or store your full card number, CVV, or billing address.

Usage data — we may collect standard server-side logs including IP addresses, pages visited, and referral sources for debugging and abuse prevention. This data is not sold or shared with third parties for advertising.

Referral codes — if you share a referral link and others pledge through it, we record the conversion against your referral code to track your sharing impact. No personal data about referees is shared with you beyond aggregate counts.`,
  },
  {
    title: '3. Payment Data and Stripe',
    body: `All payment processing is handled by Stripe, Inc. (stripe.com). Your full payment credentials (card number, CVV, expiry) are entered directly into Stripe's secure payment fields and are never transmitted to or stored on Shipdit servers.

By using Shipdit's payment features you are also subject to Stripe's Privacy Policy, available at stripe.com/privacy.

Pledge holds are authorized through Stripe and only captured (charged) when a funding goal is reached. If a goal is not met, the authorization is released and no charge occurs.`,
  },
  {
    title: '4. How We Use Your Data',
    body: `We use your email to:
— Confirm your pledge or idea submission
— Notify you when an idea you backed is funded, built, or cancelled
— Send hosting reminders for apps you helped fund
— Respond to support requests

We do not sell your email address or any personal data to third parties. We do not use your data for advertising purposes.`,
  },
  {
    title: '5. Cookies and Analytics',
    body: `Shipdit uses functional cookies required for authentication (managed by Supabase). These cookies are strictly necessary for the site to work and cannot be disabled without breaking login functionality.

We do not currently use third-party advertising cookies or tracking pixels. If we add analytics in the future, this policy will be updated to reflect that.`,
  },
  {
    title: '6. Data Retention',
    body: `We retain your account data and pledge history for as long as your account is active and for a reasonable period after. If you would like your data deleted, email dallin@shipdit.co and we will remove your personal data within 30 days, subject to any legal retention obligations.`,
  },
  {
    title: '7. Third-Party Services',
    body: `Shipdit uses the following third-party services that may process your data:

Supabase — database and authentication (supabase.com)
Stripe — payment processing (stripe.com)
Resend — transactional email delivery (resend.com)
Vercel — hosting and edge functions (vercel.com)

Each service operates under its own privacy policy. We share only the data necessary for each service to function.`,
  },
  {
    title: '8. Your Rights',
    body: `You have the right to access, correct, or delete the personal data we hold about you. To exercise these rights, email dallin@shipdit.co. We will respond within 30 days.

If you are located in the EU or UK, you may also have rights under GDPR including the right to data portability and the right to lodge a complaint with your local supervisory authority.`,
  },
  {
    title: '9. Changes to This Policy',
    body: `We may update this policy from time to time. We will notify you of significant changes via email if you have an account. Continued use of the platform after changes constitutes acceptance. Last updated: March 2026.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Privacy Policy</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-5xl" style={{ color: '#000080' }}>
            PRIVACY POLICY
          </h1>
          <p className="text-xs mt-2" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
            Last updated: March 2026 · Questions? Email{' '}
            <a href="mailto:dallin@shipdit.co" style={{ color: '#000080' }}>dallin@shipdit.co</a>
          </p>
        </div>
      </div>

      {SECTIONS.map((s) => (
        <div key={s.title} className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">{s.title}</span>
          </div>
          <div className="p-4">
            {s.body.split('\n\n').map((para, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed"
                style={{ fontFamily: 'Share Tech Mono, monospace', marginBottom: i < s.body.split('\n\n').length - 1 ? 12 : 0 }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
