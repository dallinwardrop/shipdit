'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const TIERS = [
  { amountCents: 500,   label: '$5' },
  { amountCents: 1000,  label: '$10' },
  { amountCents: 2500,  label: '$25' },
  { amountCents: 5000,  label: '$50' },
]

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

// ── Card form (inside <Elements>) ────────────────────────────────────────────

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

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    })

    setConfirming(false)
    if (error) {
      onError(error.message ?? 'Payment failed.')
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess()
    } else {
      onError('Payment did not complete. Please try again.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="win95-sunken p-3">
        <CardElement options={cardElementOptions} />
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={confirming}
        className="win95-btn win95-btn-primary w-full"
        style={{ padding: '10px', fontSize: '1rem', fontFamily: 'VT323, monospace' }}
      >
        {confirming ? 'Processing…' : 'CONTRIBUTE NOW'}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function HostingContribute({
  appIdeaId,
  slug,
  appName,
}: {
  appIdeaId: string
  slug: string
  appName: string
}) {
  const router = useRouter()
  const [selectedCents, setSelectedCents] = useState<number | null>(null)
  const [customDollars, setCustomDollars] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  const activeCents = customDollars
    ? Math.round(parseFloat(customDollars) * 100)
    : selectedCents

  const handleContribute = async () => {
    if (!activeCents || activeCents < 100) {
      setError('Minimum contribution is $1.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/hosting/contribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_idea_id: appIdeaId, amount: activeCents }),
    })

    if (res.status === 401) {
      router.push(`/login?redirectTo=/hosting/${slug}`)
      return
    }

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    setClientSecret(json.client_secret)
    setLoading(false)
  }

  if (succeeded) {
    return (
      <div
        className="win95-raised p-4 text-sm space-y-2"
        style={{ borderColor: '#008000 #004000 #004000 #008000', background: '#d0ffd0' }}
      >
        <div className="font-vt323 text-2xl" style={{ color: '#004000' }}>✓ Thank you!</div>
        <p style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
          Your contribution helps keep <strong>{appName}</strong> free for everyone.
        </p>
      </div>
    )
  }

  return (
    <div className="win95-window">
      <div className="win95-title-bar">
        <span className="font-vt323 text-xl">contribute.exe</span>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
          Every dollar keeps this app <strong>free for everyone</strong>. Your contribution goes
          directly to hosting costs.
        </p>

        {!clientSecret && (
          <>
            {/* Tiers */}
            <div className="flex flex-wrap gap-2">
              {TIERS.map((tier) => {
                const isSelected = selectedCents === tier.amountCents && !customDollars
                return (
                  <button
                    key={tier.amountCents}
                    type="button"
                    onClick={() => { setSelectedCents(tier.amountCents); setCustomDollars('') }}
                    className="win95-btn"
                    style={{
                      background: isSelected ? '#000080' : '#c0c0c0',
                      color: isSelected ? '#fff' : '#000',
                      borderColor: isSelected
                        ? '#000040 #8080ff #8080ff #000040'
                        : '#fff #808080 #808080 #fff',
                      padding: '6px 14px',
                      fontFamily: 'VT323, monospace',
                      fontSize: 18,
                    }}
                  >
                    {tier.label}
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

            {error && (
              <div className="win95-sunken p-2 text-xs" style={{ color: 'darkred' }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleContribute}
              disabled={loading || !activeCents}
              className="win95-btn win95-btn-primary w-full"
              style={{ padding: '10px', fontSize: '1rem', fontFamily: 'VT323, monospace' }}
            >
              {loading ? 'Processing…' : 'CONTRIBUTE TO HOSTING'}
            </button>
          </>
        )}

        {/* Step 2: card input */}
        {clientSecret && (
          <Elements stripe={stripePromise}>
            <CardForm
              clientSecret={clientSecret}
              onSuccess={() => setSucceeded(true)}
              onError={(msg) => setError(msg)}
            />
            {error && (
              <div className="win95-sunken p-2 text-xs mt-2" style={{ color: 'darkred' }}>
                {error}
              </div>
            )}
          </Elements>
        )}
      </div>
    </div>
  )
}
