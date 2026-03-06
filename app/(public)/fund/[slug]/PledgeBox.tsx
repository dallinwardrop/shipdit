'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { daysUntil } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const TIERS = [
  { amountCents: 1000,   label: 'Watcher',   perk: 'Get notified when it launches', type: 'watch' as const },
  { amountCents: 10000,  label: 'Supporter',  perk: 'Supporter credit in the app',   type: 'pledge' as const },
  { amountCents: 50000,  label: 'Backer',     perk: 'Early demo access',             type: 'pledge' as const },
  { amountCents: 100000, label: 'Patron',     perk: 'Your name in the credits',      type: 'pledge' as const },
  { amountCents: 500000, label: 'Legend',     perk: 'Legend badge + all perks',      type: 'pledge' as const },
]

const PRIORITY_COLORS: Record<string, string> = {
  'MUST HAVE':    '#cc0000',
  'SHOULD HAVE':  '#886600',
  'NICE TO HAVE': '#404040',
}

const cardElementOptions = {
  style: {
    base: {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '14px',
      color: '#000',
      '::placeholder': { color: '#808080' },
    },
    invalid: { color: 'darkred' },
  },
}

// ── Card confirmation form (must live inside <Elements>) ──────────────────────

function CardForm({
  clientSecret,
  onSuccess,
  onError,
}: {
  clientSecret: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setConfirming(true)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setConfirming(false); return }

    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    })

    if (error) {
      onError(error.message ?? 'Payment failed.')
      setConfirming(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="space-y-2">
      <div className="win95-sunken p-2" style={{ background: '#fff' }}>
        <CardElement options={cardElementOptions} />
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={confirming || !stripe}
        className="win95-btn win95-btn-primary w-full"
        style={{ padding: '10px', fontSize: '1rem', fontFamily: 'VT323, monospace' }}
      >
        {confirming ? 'Processing...' : 'CONFIRM PAYMENT'}
      </button>
    </div>
  )
}

// ── Main PledgeBox ────────────────────────────────────────────────────────────

export function PledgeBox({
  appIdeaId,
  slug,
  fundingDeadline,
}: {
  appIdeaId: string
  slug: string
  fundingDeadline?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedCents, setSelectedCents] = useState<number | null>(null)
  const [customDollars, setCustomDollars] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pledged, setPledged] = useState(searchParams.get('pledged') === '1')
  const [anonymous, setAnonymous] = useState(false)

  const refCode = searchParams.get('ref') ?? undefined

  const activeCents = customDollars
    ? Math.round(parseFloat(customDollars) * 100)
    : selectedCents

  const activeType =
    activeCents === 1000 ? 'watch'
    : activeCents != null && activeCents > 0 ? 'pledge'
    : null

  const handlePledge = async () => {
    if (!activeCents || activeCents < 100) {
      setError('Minimum pledge is $1.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/pledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_idea_id: appIdeaId,
        amount: activeCents,
        type: activeType,
        ref_code: refCode,
        anonymous,
      }),
    })

    if (res.status === 401) {
      router.push(`/login?redirectTo=/fund/${slug}`)
      return
    }

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    console.log('[PledgeBox] clientSecret received:', json.client_secret?.slice(0, 20) + '…')
    setClientSecret(json.client_secret)
    setLoading(false)
  }

  // ── Success state ───────────────────────────────────────────────────────────

  if (pledged) {
    return (
      <div
        className="win95-raised p-4 text-sm space-y-2"
        style={{ borderColor: '#008000 #004000 #004000 #008000', background: '#d0ffd0' }}
      >
        <div className="font-vt323 text-2xl" style={{ color: '#004000' }}>✓ Pledge received!</div>
        <p style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
          Your card is <strong>authorized but not charged</strong> until the funding goal is hit.
          You&apos;ll get an email when this app is funded. 100% refunded if not funded in 7 days.
        </p>
      </div>
    )
  }

  const days = daysUntil(fundingDeadline ?? null)
  const isClosingSoon = days !== null && days <= 3 && days >= 0
  const showUrgency = days !== null && days <= 7 && days >= 0

  return (
    <div className="space-y-3">
      {showUrgency && (
        <div
          className="win95-raised p-2 text-xs text-center"
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            background: isClosingSoon ? '#fff0f0' : '#fff8e8',
            borderColor: isClosingSoon ? '#cc0000 #660000 #660000 #cc0000' : '#804000 #402000 #402000 #804000',
            color: isClosingSoon ? 'darkred' : '#804000',
            fontWeight: 'bold',
          }}
        >
          {isClosingSoon
            ? `⚠️ Closing soon! ${days === 0 ? 'Last day' : `${days} day${days !== 1 ? 's' : ''} left`} to fund this.`
            : `⚡ ${days} day${days !== 1 ? 's' : ''} left to fund this.`}
        </div>
      )}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">pledge_now.exe</span>
        </div>
        <div className="p-3 space-y-3">
          <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
            Your card is <strong>authorized only</strong> — never charged until the funding goal
            is hit. 100% refunded if not funded in 7 days.
          </p>

          {/* Tier cards — hide once we have a clientSecret */}
          {!clientSecret && (
            <>
              <div className="space-y-1">
                {TIERS.map((tier) => {
                  const dollars = tier.amountCents / 100
                  const isSelected = selectedCents === tier.amountCents && !customDollars
                  return (
                    <button
                      key={tier.amountCents}
                      type="button"
                      onClick={() => { setSelectedCents(tier.amountCents); setCustomDollars('') }}
                      className="w-full text-left"
                      style={{
                        background: isSelected ? '#000080' : '#c0c0c0',
                        color: isSelected ? '#fff' : '#000',
                        border: '2px solid',
                        borderColor: isSelected
                          ? '#000040 #8080ff #8080ff #000040'
                          : '#fff #808080 #808080 #fff',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontFamily: 'Share Tech Mono, monospace',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        <span className="font-vt323" style={{ fontSize: 18 }}>
                          ${dollars.toLocaleString()}
                        </span>
                        {' — '}
                        <strong>{tier.label}</strong>
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>{tier.perk}</span>
                    </button>
                  )
                })}
              </div>

              {/* Custom amount */}
              <div className="flex gap-2 items-center">
                <span className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', whiteSpace: 'nowrap' }}>
                  Custom $:
                </span>
                <input
                  type="number"
                  min="1"
                  className="win95-input"
                  placeholder="Other amount"
                  value={customDollars}
                  onChange={(e) => { setCustomDollars(e.target.value); setSelectedCents(null) }}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="win95-sunken p-2 text-xs" style={{ color: 'darkred' }}>
              ⚠ {error}
            </div>
          )}

          {/* Anonymous toggle + CTA */}
          {!clientSecret && (
            <div className="space-y-2">
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  fontFamily: 'Share Tech Mono, monospace', fontSize: 11,
                }}
              >
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Pledge anonymously (hide my name from the backer wall)
              </label>
              <button
                type="button"
                onClick={handlePledge}
                disabled={loading || !activeCents}
                className="win95-btn win95-btn-primary w-full"
                style={{ padding: '10px', fontSize: '1rem', fontFamily: 'VT323, monospace' }}
              >
                {loading ? 'Processing...' : 'BACK THIS APP'}
              </button>
            </div>
          )}

          {/* Step 2: enter card details */}
          {clientSecret && (
            <div className="space-y-2">
              <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#004000' }}>
                ✓ Amount reserved. Enter your card to authorize:
              </p>
              {/* Elements without clientSecret in options — CardElement uses legacy flow */}
              <Elements stripe={stripePromise}>
                <CardForm
                  clientSecret={clientSecret}
                  onSuccess={() => setPledged(true)}
                  onError={(msg) => { setError(msg); setClientSecret(null) }}
                />
              </Elements>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PriorityTag({ priority }: { priority: string }) {
  return (
    <span
      className="win95-raised px-1 text-xs flex-shrink-0"
      style={{
        color: PRIORITY_COLORS[priority] ?? '#000',
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 10,
        whiteSpace: 'nowrap',
      }}
    >
      {priority}
    </span>
  )
}
