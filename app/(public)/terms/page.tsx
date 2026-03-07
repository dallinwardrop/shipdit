import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Shipdit',
}

const SECTIONS = [
  {
    title: '1. What Is Shipdit',
    body: `Shipdit is a community-funded app-building platform. Users submit app ideas, pledge money toward a build goal, and when the goal is reached, Shipdit builds the app and releases it free for everyone. Shipdit is operated as a sole proprietorship. By using the site you agree to these terms.`,
  },
  {
    title: '2. Pledge Hold, Capture, and Refund Policy',
    body: `When you pledge to fund an app idea, your payment method is authorized (held) but not immediately charged. Your card is only captured (charged) if and when the full funding goal is reached within the 7-day funding window.

If the funding goal is not reached within 7 days, all authorization holds are released and you are not charged. If a project is cancelled or rejected after you have pledged, your hold will be released within a reasonable timeframe, typically 1–5 business days depending on your card issuer.

Captured funds are non-refundable once a build has commenced, except at Shipdit's sole discretion. Hosting contributions made to keep live apps online are non-refundable once processed.`,
  },
  {
    title: '3. No Guarantee of Delivery',
    body: `Shipdit makes no guarantee that a funded app will be delivered within any specific timeframe or that it will meet every feature request described in the original submission. Build scope, timelines, and final feature sets are determined by Shipdit at its discretion.

In the unlikely event that Shipdit is unable to complete a funded app, backers will be issued full refunds for any captured pledges.`,
  },
  {
    title: '4. Idea Review and Rejection',
    body: `Shipdit reserves the right to reject any submitted idea for any reason, including but not limited to: technical infeasibility, legal concerns, similarity to existing products, inappropriate content, or insufficient pledge amount. Rejected ideas have their pledge holds released.

Approved ideas are not endorsements. Shipdit may remove or de-list an idea at any time before a build commences.`,
  },
  {
    title: '5. User Conduct',
    body: `You agree not to submit ideas that are illegal, harmful, harassing, defamatory, or infringing on third-party intellectual property. You agree not to attempt to manipulate pledge counts, circumvent payment systems, or use the platform in any fraudulent manner.

Shipdit reserves the right to ban accounts and cancel pledges from users who violate these terms.`,
  },
  {
    title: '6. Payments via Stripe',
    body: `All payment processing is handled by Stripe, Inc. By pledging, you agree to Stripe's Terms of Service and Privacy Policy. Shipdit does not store your full card number, CVV, or other raw payment credentials. Payment data is transmitted directly to Stripe via their secure APIs.

Shipdit may receive and store limited payment metadata from Stripe such as payment intent IDs, last four digits, and charge status for record-keeping and support purposes.`,
  },
  {
    title: '7. Intellectual Property',
    body: `Apps built through Shipdit are released free for public use. The underlying code and intellectual property of built apps remains owned by Shipdit unless explicitly stated otherwise. Submitting an idea does not grant you ownership of the resulting app or its codebase.`,
  },
  {
    title: '8. Limitation of Liability',
    body: `Shipdit is provided "as is." To the maximum extent permitted by law, Shipdit disclaims all warranties and shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.`,
  },
  {
    title: '9. Changes to These Terms',
    body: `Shipdit may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms. Last updated: March 2026.`,
  },
]

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Terms of Service</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-5xl" style={{ color: '#000080' }}>
            TERMS OF SERVICE
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
