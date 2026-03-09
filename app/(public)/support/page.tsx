'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

const AMOUNT_PRESETS = [1000, 2500, 5000, 10000] // cents: $10, $25, $50, $100

function SupportForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [mode, setMode] = useState<'one_time' | 'monthly'>('one_time')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(2500)
  const [customAmount, setCustomAmount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const effectiveAmount = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : (selectedPreset ?? 0)

  const formatDollars = (cents: number) =>
    cents >= 100 ? `$${(cents / 100).toLocaleString()}` : `$${(cents / 100).toFixed(2)}`

  const handlePreset = (cents: number) => {
    setSelectedPreset(cents)
    setCustomAmount('')
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomAmount(e.target.value)
    setSelectedPreset(null)
  }

  const handleSubmit = async () => {
    if (!stripe || !elements) return
    if (!effectiveAmount || effectiveAmount < 100) {
      setApiError('Minimum support is $1.')
      return
    }

    setConfirming(true)
    setCardError(null)
    setApiError(null)

    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: effectiveAmount, mode }),
    })

    if (res.status === 401) {
      router.push('/login?redirectTo=/support')
      return
    }

    const json = await res.json()

    if (!res.ok || !json.client_secret) {
      setApiError(json.error ?? 'Something went wrong.')
      setConfirming(false)
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setConfirming(false); return }

    const { error } = await stripe.confirmCardPayment(json.client_secret, {
      payment_method: { card: cardElement },
    })

    if (error) {
      setCardError(error.message ?? 'Payment failed.')
      setConfirming(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div
        className="p-6 text-center space-y-2"
        style={{
          background: '#d0ffd0',
          border: '2px solid',
          borderColor: '#008000 #004000 #004000 #008000',
          fontFamily: 'Share Tech Mono, monospace',
        }}
      >
        <div className="font-vt323 text-5xl" style={{ color: '#004000' }}>✓ Thank You!</div>
        <div className="text-sm" style={{ color: '#004000' }}>
          {mode === 'monthly'
            ? `Your ${formatDollars(effectiveAmount)}/month subscription is active. You can cancel anytime.`
            : `${formatDollars(effectiveAmount)} received. Every bit helps keep Shipdit running.`}
        </div>
        <a
          href="/"
          className="win95-btn win95-btn-primary text-sm"
          style={{ display: 'inline-block', marginTop: 8, textDecoration: 'none', fontFamily: 'VT323, monospace', fontSize: '1rem' }}
        >
          Back to Fund Queue
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* One-time / Monthly toggle */}
      <div>
        <div className="text-xs mb-2" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
          Contribution type:
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['one_time', 'monthly'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="win95-btn text-sm"
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                flex: 1,
                ...(mode === m
                  ? { background: '#000080', color: '#fff', borderColor: '#000040 #8080ff #8080ff #000040' }
                  : {}),
              }}
            >
              {m === 'one_time' ? 'One-time' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* Amount presets */}
      <div>
        <div className="text-xs mb-2" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
          Amount{mode === 'monthly' ? '/month' : ''}:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
          {AMOUNT_PRESETS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => handlePreset(cents)}
              className="win95-btn"
              style={{
                fontFamily: 'VT323, monospace',
                fontSize: '1.1rem',
                textAlign: 'center',
                padding: '6px 2px',
                ...(selectedPreset === cents
                  ? { background: '#000080', color: '#fff', borderColor: '#000040 #8080ff #8080ff #000040' }
                  : {}),
              }}
            >
              {formatDollars(cents)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ fontFamily: 'Share Tech Mono, monospace' }}>$</span>
          <input
            type="number"
            min="1"
            step="1"
            className="win95-input flex-1"
            placeholder="Custom amount"
            value={customAmount}
            onChange={handleCustomChange}
          />
        </div>
      </div>

      {/* Card element */}
      <div>
        <div className="text-xs mb-2" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
          Card details:
        </div>
        <div className="win95-sunken p-2" style={{ background: '#fff' }}>
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {/* Errors */}
      {(cardError || apiError) && (
        <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: 'darkred' }}>
          ⚠ {cardError ?? apiError}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={confirming || !stripe || effectiveAmount < 100}
        className="win95-btn win95-btn-primary w-full"
        style={{
          padding: '10px',
          fontSize: '1.2rem',
          fontFamily: 'VT323, monospace',
          ...(confirming ? { opacity: 0.8, cursor: 'default' } : {}),
        }}
      >
        {confirming
          ? '⌛ Processing...'
          : effectiveAmount >= 100
            ? `SUPPORT SHIPDIT — ${formatDollars(effectiveAmount)}${mode === 'monthly' ? '/mo' : ''}`
            : 'SUPPORT SHIPDIT'}
      </button>

      <div className="text-xs text-center" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
        {mode === 'monthly'
          ? 'Cancel anytime. Billed monthly via Stripe.'
          : 'One-time charge. Processed securely via Stripe.'}
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <Elements stripe={stripePromise}>
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="win95-window">
          <div className="win95-title-bar" style={{ background: '#5a3000' }}>
            <span className="font-vt323 text-xl">⭐ support.exe</span>
          </div>
          <div className="p-4">
            <h1 className="font-vt323 text-5xl" style={{ color: '#5a3000', lineHeight: 1 }}>
              Support Shipdit
            </h1>
            <p className="mt-2 text-sm" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
              Shipdit is built and maintained by one person. Every contribution goes directly toward
              hosting, maintenance, and building new features for the community.
            </p>
          </div>
        </div>

        {/* What your support funds */}
        <div className="win95-window">
          <div className="win95-title-bar" style={{ background: '#000060' }}>
            <span className="font-vt323 text-lg">Where It Goes</span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-3 text-xs text-center">
            {[
              { icon: '🖥️', label: 'Servers & hosting' },
              { icon: '🔨', label: 'New features' },
              { icon: '☕', label: 'Developer fuel' },
            ].map(({ icon, label }) => (
              <div key={label} className="win95-raised p-2 space-y-1">
                <div className="font-vt323 text-3xl">{icon}</div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contribution form */}
        <div className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">Make a Contribution</span>
          </div>
          <div className="p-4">
            <SupportForm />
          </div>
        </div>
      </div>
    </Elements>
  )
}
