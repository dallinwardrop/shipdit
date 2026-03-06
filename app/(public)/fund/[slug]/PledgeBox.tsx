'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

export function PledgeBox({
  appIdeaId,
  slug,
}: {
  appIdeaId: string
  slug: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justPledged = searchParams.get('pledged') === '1'

  const [selectedCents, setSelectedCents] = useState<number | null>(null)
  const [customDollars, setCustomDollars] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refCode = searchParams.get('ref') ?? undefined

  const activeCents = customDollars
    ? Math.round(parseFloat(customDollars) * 100)
    : selectedCents

  const activeType =
    activeCents === 1000
      ? 'watch'
      : activeCents != null && activeCents > 0
      ? 'pledge'
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

    router.push(`/fund/${slug}?pledged=1`)
  }

  return (
    <div className="space-y-3">
      {/* Success banner */}
      {justPledged && (
        <div
          className="win95-raised p-3 text-sm"
          style={{ borderColor: '#008000 #004000 #004000 #008000', background: '#d0ffd0' }}
        >
          ✓ <strong>Pledge received!</strong> Your card is authorized but not charged until the
          goal is hit. You&apos;ll get an email when this app is funded.
        </div>
      )}

      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">pledge_now.exe</span>
        </div>
        <div className="p-3 space-y-3">
          <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
            Your card is <strong>authorized only</strong> — never charged until the funding goal
            is hit. 100% refunded if not funded in 120 days.
          </p>

          {/* Tier cards */}
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
                    border: `2px solid`,
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

          {/* Error */}
          {error && (
            <div className="win95-sunken p-2 text-xs" style={{ color: 'darkred' }}>
              ⚠ {error}
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handlePledge}
            disabled={loading || (!activeCents && !customDollars)}
            className="win95-btn win95-btn-primary w-full"
            style={{ padding: '10px', fontSize: '1rem', fontFamily: 'VT323, monospace' }}
          >
            {loading ? 'Processing...' : 'BACK THIS APP'}
          </button>
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
