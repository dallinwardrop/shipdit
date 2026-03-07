'use client'

import { useState } from 'react'

const FAQ: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: 'How It Works',
    items: [
      {
        q: 'What is Shipdit?',
        a: 'Shipdit is a community-funded app platform. Anyone can submit an app idea with a pledge. When the community funds the goal, I build it — and everyone gets it free, forever.',
      },
      {
        q: 'How does the funding process work?',
        a: 'Submit an idea and pledge what you\'re willing to put in. Your idea goes into review — typically approved within 2–3 hours. Once approved and live, the community can back it. When total pledges hit the build price within 72 hours, all cards are charged and I start building. If the goal isn\'t hit, every pledge is fully refunded.',
      },
      {
        q: 'Who decides which ideas get built?',
        a: 'The community does, with their pledges. I review every submission for feasibility before it goes live in the queue. Once live, whoever funds it fastest gets it built first.',
      },
      {
        q: 'What happens after an app is built?',
        a: 'It gets published as a live app on Shipdit, free for everyone to use — including people who never pledged. Backers keep their app running by optionally contributing to hosting costs.',
      },
    ],
  },
  {
    section: 'Money & Payments',
    items: [
      {
        q: 'When does my card get charged?',
        a: 'Your card is authorized (a hold is placed) when you pledge, but never charged until the funding goal is hit. If the goal isn\'t reached within 72 hours of going live, the hold is released and you owe nothing.',
      },
      {
        q: 'Is my payment information safe?',
        a: 'Yes. Shipdit never sees or stores your card details. All payments are processed by Stripe, which is used by millions of businesses worldwide and is fully PCI compliant.',
      },
      {
        q: 'How do refunds work?',
        a: 'If an idea doesn\'t reach its funding goal within 72 hours of going live, all pledges are automatically refunded. No action needed on your part.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'All major credit and debit cards via Stripe. More payment methods coming soon.',
      },
      {
        q: 'Do I need to update my payment info?',
        a: 'No — your card is authorized when you pledge and only charged if the funding goal is hit within 72 hours. You don\'t need to do anything else. If your card is declined at capture time we\'ll notify you.',
      },
      {
        q: 'How long is my card held?',
        a: 'Your card is authorized (not charged) when you pledge. If the goal is hit within 72 hours, your card is captured. If not, the hold is automatically released — no charge, no action needed from you.',
      },
    ],
  },
  {
    section: 'Ideas & Building',
    items: [
      {
        q: 'Can I submit more than one idea?',
        a: 'Yes — submit as many ideas as you want. Each requires its own pledge commitment.',
      },
      {
        q: 'How long does funding stay open?',
        a: '72 hours from when the idea goes live in the queue. Ideas are typically approved within 2–3 hours of submission — the 72-hour countdown starts at approval, not submission. After that, unfunded ideas expire and all pledges are refunded.',
      },
      {
        q: 'Why only 72 hours?',
        a: 'Urgency drives action. A 72-hour window means you have three focused days to rally your community, make TikToks, and get it funded. The clock starts when your idea is approved — usually within a few hours of submission. If it doesn\'t hit the goal, all holds are released and no one gets charged. You can always resubmit and try again.',
      },
      {
        q: 'What if the app doesn\'t get built?',
        a: 'Every funded idea comes with a 72-hour build guarantee. Once payments are captured, a working MVP will be delivered within 72 hours — or every backer receives a full automatic refund. No disputes, no waiting. If I can\'t deliver, you get your money back immediately.',
      },
      {
        q: 'Who builds the apps?',
        a: 'I do — Dallin Wardrop, a product manager and developer with 10+ years building software products. Shipdit is my commitment to build what the community actually wants.',
      },
      {
        q: 'Will the app really be free for everyone?',
        a: 'Yes. Once funded and built, the app is free for any user — whether they pledged or not. Backers help keep it running by optionally funding hosting.',
      },
      {
        q: 'Can I pledge to the same idea multiple times?',
        a: 'Yes — you can back an idea at multiple tiers or pledge additional amounts anytime before the goal is hit.',
      },
    ],
  },
  {
    section: 'Your Account',
    items: [
      {
        q: 'Do I need an account to browse?',
        a: 'No — anyone can view the funding queue and idea details without an account. You only need to sign in when you pledge or submit an idea.',
      },
      {
        q: 'How do I track my pledges?',
        a: 'After signing in, your active pledges and their status are visible from your profile. You\'ll also receive email updates when ideas you\'ve backed reach milestones.',
      },
      {
        q: 'Is my email address safe?',
        a: 'Your email is only used to send you updates about ideas you\'ve backed or submitted. We never sell or share your data with third parties.',
      },
    ],
  },
]

export default function FAQPage() {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key))

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">faq.txt</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-5xl" style={{ color: '#000080' }}>
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
            Everything you need to know about how Shipdit works.
          </p>
        </div>
      </div>

      {/* Sections */}
      {FAQ.map((section) => (
        <div key={section.section} className="win95-window">
          <div className="win95-title-bar" style={{ background: '#000060' }}>
            <span className="font-vt323 text-lg">{section.section}</span>
          </div>
          <div className="p-2 space-y-1">
            {section.items.map((item) => {
              const key = `${section.section}::${item.q}`
              const isOpen = openKey === key
              return (
                <div key={key} className="win95-raised">
                  {/* Question row */}
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="w-full text-left"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 10px',
                      background: isOpen ? '#000080' : 'transparent',
                      color: isOpen ? '#fff' : '#000',
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 13,
                      cursor: 'pointer',
                      border: 'none',
                      width: '100%',
                    }}
                  >
                    <span>{item.q}</span>
                    <span
                      style={{
                        flexShrink: 0,
                        marginLeft: 12,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        opacity: 0.7,
                      }}
                    >
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Answer panel */}
                  {isOpen && (
                    <div
                      className="win95-sunken"
                      style={{
                        padding: '10px 12px',
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: '#1a1a1a',
                        borderTop: '1px solid #808080',
                      }}
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
