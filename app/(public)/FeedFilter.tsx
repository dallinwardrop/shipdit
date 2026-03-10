'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatDollars, progressPercent, hoursUntil, formatTimeLeft, truncate } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type AppIdea = Database['public']['Tables']['app_ideas']['Row']
export type IdeaWithTopDonor = AppIdea & { top_donor_name: string | null }

export type SpotlightData = {
  label: string
  name: string
  amount: number
  appTitle?: string
}

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

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  submitted:      { label: 'PENDING REVIEW',     color: '#404040', bg: '#d4d4d4' },
  under_review:   { label: 'PENDING REVIEW',     color: '#404040', bg: '#d4d4d4' },
  awaiting_price: { label: 'AWAITING PRICE',     color: '#664400', bg: '#fff0c0' },
  priced:         { label: 'PRICED',             color: '#664400', bg: '#fff0c0' },
  live:           { label: 'ACCEPTING PLEDGES',  color: '#003300', bg: '#c0ffc0' },
  funded:         { label: 'FUNDED',             color: '#000060', bg: '#c0c8ff' },
  building:       { label: 'BEING BUILT',        color: '#000060', bg: '#c0c8ff' },
  in_review:      { label: 'BEING BUILT',        color: '#000060', bg: '#c0c8ff' },
  built:          { label: 'SHIPD',              color: '#300060', bg: '#e8c0ff' },
  expired:        { label: 'EXPIRED',            color: '#808080', bg: '#d0d0d0' },
}

// ── Filter definitions ────────────────────────────────────────────────────────

type FilterKey = 'all' | 'pending' | 'pledges' | 'funded' | 'built' | 'unfunded'

const MAIN_FILTERS: { key: FilterKey; label: string; statuses: string[] | null }[] = [
  { key: 'all',     label: 'All',               statuses: null },
  { key: 'pending', label: 'Pending Review',     statuses: ['submitted', 'under_review', 'awaiting_price', 'priced'] },
  { key: 'pledges', label: 'Accepting Pledges',  statuses: ['live'] },
  { key: 'funded',  label: 'Funded',             statuses: ['funded', 'building', 'in_review'] },
  { key: 'built',   label: 'Shipd',              statuses: ['built'] },
]

const EXPIRED_STATUSES = ['expired']

// ── Pledge tiers ──────────────────────────────────────────────────────────────

const PLEDGE_TIERS = [
  { amountCents: 1000,   dollars: 10,   label: 'Watcher',   perk: 'Get notified when it launches', type: 'watch'  as const },
  { amountCents: 10000,  dollars: 100,  label: 'Supporter', perk: 'Supporter credit in the app',   type: 'pledge' as const },
  { amountCents: 50000,  dollars: 500,  label: 'Backer',    perk: 'Early demo access',             type: 'pledge' as const },
  { amountCents: 100000, dollars: 1000, label: 'Patron',    perk: 'Your name in the credits',      type: 'pledge' as const },
]

const SUPPORT_TIERS = [
  { amountCents: 1000,  dollars: 10  },
  { amountCents: 2500,  dollars: 25  },
  { amountCents: 5000,  dollars: 50  },
  { amountCents: 10000, dollars: 100 },
  { amountCents: 50000, dollars: 500 },
]

const SHIPDIT_MONTHLY_GOAL_CENTS = 50000 // $500/month

// ── Open pledge state ─────────────────────────────────────────────────────────

type OpenPledge = {
  ideaId: string
  amountCents: number
  phase: 'loading' | 'card' | 'success'
  clientSecret: string | null
  apiError: string | null
}

type OpenSupport = {
  amountCents: number
  phase: 'loading' | 'card' | 'success'
  clientSecret: string | null
  apiError: string | null
}

// ── Inline card form (must render inside <Elements>) ──────────────────────────

function InlinePledgeForm({
  clientSecret,
  amountCents,
  onSuccess,
  confirmText = 'CONFIRM PLEDGE',
  noteText,
}: {
  clientSecret: string
  amountCents: number
  onSuccess: () => void
  confirmText?: string
  noteText?: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [confirming, setConfirming] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setConfirming(true)
    setCardError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setConfirming(false); return }

    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    })

    if (error) {
      setCardError(error.message ?? 'Payment failed.')
      setConfirming(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
        {noteText ?? `${formatDollars(amountCents)} — held on card, not charged until goal is reached.`}
      </div>
      <div className="win95-sunken p-2" style={{ background: '#fff' }}>
        <CardElement options={cardElementOptions} />
      </div>
      {cardError && (
        <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: 'darkred' }}>
          ⚠ {cardError}
        </div>
      )}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={confirming || !stripe}
        className="win95-btn win95-btn-primary w-full"
        style={{
          padding: '8px',
          fontSize: '1rem',
          fontFamily: 'VT323, monospace',
          ...(confirming ? { borderColor: '#808080 #fff #fff #808080', cursor: 'default', opacity: 0.85 } : {}),
        }}
      >
        {confirming ? '⌛ Processing...' : confirmText}
      </button>
    </div>
  )
}

// ── Shipdit pinned support card ───────────────────────────────────────────────

function ShipditCard({
  openSupport,
  spotlight,
  onTierClick,
  onClose,
  onSuccess,
}: {
  openSupport: OpenSupport | null
  spotlight: SpotlightData | null
  onTierClick: (amountCents: number) => void
  onClose: () => void
  onSuccess: () => void
}) {
  const isPledging = openSupport !== null
  const [customDollars, setCustomDollars] = useState('')

  function handleCustomSupport() {
    const val = parseFloat(customDollars)
    if (!val || val < 1) return
    onTierClick(Math.round(val * 100))
    setCustomDollars('')
  }

  return (
    <div
      className="win95-window"
      style={{ maxWidth: '100%', outline: '2px solid #5a3000' }}
    >
      {/* Title bar */}
      <Link href="/support" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div className="win95-title-bar" style={{ background: '#5a3000' }}>
          <span className="font-vt323 text-lg truncate flex-1">⭐ Shipdit</span>
          <span
            className="text-xs flex-shrink-0 mx-1 px-1"
            style={{
              fontFamily: 'Share Tech Mono, monospace',
              color: '#5a3000',
              background: '#ffd080',
              border: '1px solid #a06000',
              whiteSpace: 'nowrap',
            }}
          >
            PLATFORM
          </span>
          <div className="flex gap-1 flex-shrink-0">
            {['_', '□', '✕'].map((ch) => (
              <div key={ch} className="win95-btn" style={{ minWidth: 16, padding: '0 6px', fontSize: 10, lineHeight: '16px' }}>
                {ch}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-3 space-y-2">
          <p className="text-sm leading-snug" style={{ color: '#000' }}>
            Built and maintained by the Shipdit team. Your support keeps the platform running and funds future development.
          </p>

          {/* Spotlight row */}
          <div className="win95-sunken p-2 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#5a3000' }}>
            {spotlight ? (
              <>
                <div style={{ fontWeight: 'bold' }}>
                  {spotlight.label}{' '}
                  <span style={{ color: '#3a1800' }}>{spotlight.name}</span>
                  {' — '}{formatDollars(spotlight.amount)}
                  {spotlight.appTitle && (
                    <span style={{ fontWeight: 'normal', opacity: 0.75 }}> on {spotlight.appTitle}</span>
                  )}
                </div>
              </>
            ) : (
              <span style={{ fontWeight: 'bold' }}>⭐ OFFICIAL SHIPDIT PROJECT</span>
            )}
          </div>
        </div>
      </Link>

      {/* Support section */}
      <div className="px-3 pb-3 space-y-2">
        {/* Success state */}
        {openSupport?.phase === 'success' ? (
          <div
            className="p-3 text-center"
            style={{
              background: '#d0ffd0',
              border: '2px solid',
              borderColor: '#008000 #004000 #004000 #008000',
              fontFamily: 'Share Tech Mono, monospace',
            }}
          >
            <div className="font-vt323 text-2xl" style={{ color: '#004000' }}>✓ Thank you!</div>
            <div className="text-xs" style={{ color: '#004000' }}>
              {formatDollars(openSupport.amountCents)} — your support means a lot.
            </div>
          </div>

        ) : isPledging ? (
          /* Expanded support form */
          <div className="win95-sunken p-2 space-y-2" style={{ background: '#f8f8f8' }}>
            <div className="flex justify-between items-center">
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                <span className="font-vt323" style={{ fontSize: 17, color: '#5a3000' }}>
                  {formatDollars(openSupport!.amountCents)}
                </span>
                <span style={{ marginLeft: 6, opacity: 0.65 }}>— Platform Support</span>
              </div>
              <button
                onClick={onClose}
                style={{
                  fontFamily: 'monospace', fontSize: 11, lineHeight: '16px',
                  padding: '0 6px', background: '#c0c0c0', color: '#000',
                  border: '2px solid', borderColor: '#fff #808080 #808080 #fff',
                  cursor: 'pointer', flexShrink: 0,
                }}
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>

            {openSupport!.phase === 'loading' && (
              <div className="text-xs text-center" style={{ fontFamily: 'Share Tech Mono, monospace', opacity: 0.6 }}>
                ⌛ Preparing...
              </div>
            )}

            {openSupport!.apiError && (
              <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: 'darkred' }}>
                ⚠ {openSupport!.apiError}
              </div>
            )}

            {openSupport!.phase === 'card' && openSupport!.clientSecret && (
              <InlinePledgeForm
                clientSecret={openSupport!.clientSecret}
                amountCents={openSupport!.amountCents}
                onSuccess={onSuccess}
                confirmText="SUPPORT SHIPDIT"
                noteText={`${formatDollars(openSupport!.amountCents)} — charged immediately to support the platform.`}
              />
            )}
          </div>

        ) : (
          /* Support tier buttons */
          <>
            <div className="text-xs text-center" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#5a3000' }}>
              Support the platform
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {SUPPORT_TIERS.map(({ amountCents, dollars }) => (
                <button
                  key={amountCents}
                  type="button"
                  onClick={() => onTierClick(amountCents)}
                  className="win95-btn"
                  style={{
                    textAlign: 'center',
                    padding: '4px 2px',
                    fontFamily: 'VT323, monospace',
                    fontSize: '1rem',
                    lineHeight: 1.2,
                    cursor: 'pointer',
                    background: '#5a3000',
                    color: '#fff',
                    borderColor: '#8b5e00 #2d1800 #2d1800 #8b5e00',
                  }}
                >
                  ${dollars}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                min="1"
                placeholder="Custom $"
                value={customDollars}
                onChange={(e) => setCustomDollars(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSupport()}
                className="win95-input"
                style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '3px 6px' }}
              />
              <button
                type="button"
                onClick={handleCustomSupport}
                disabled={!customDollars || parseFloat(customDollars) < 1}
                className="win95-btn"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '1rem',
                  padding: '2px 8px',
                  background: '#5a3000',
                  color: '#fff',
                  borderColor: '#8b5e00 #2d1800 #2d1800 #8b5e00',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Support →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Live countdown (≤ 2h remaining) ──────────────────────────────────────────

function LiveCountdown({ deadline }: { deadline: string }) {
  const calcSeconds = () =>
    Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))

  const [secondsLeft, setSecondsLeft] = useState(calcSeconds)

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (secondsLeft <= 0) return <span>Expired</span>

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  if (secondsLeft < 60) {
    return (
      <span style={{ color: 'darkred', fontWeight: 'bold' }}>
        ⚠️ {seconds}s left
      </span>
    )
  }

  return (
    <span style={{ color: 'darkred', fontWeight: 'bold' }}>
      ⚠️ {minutes}m {seconds.toString().padStart(2, '0')}s left
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  openPledge,
  anyPledgeOpen,
  onTierClick,
  onClose,
  onSuccess,
}: {
  idea: IdeaWithTopDonor
  openPledge: OpenPledge | null
  anyPledgeOpen: boolean
  onTierClick: (amountCents: number) => void
  onClose: () => void
  onSuccess: () => void
}) {
  const [minimized, setMinimized] = useState(false)

  const pct = idea.build_price ? progressPercent(idea.amount_raised, idea.build_price) : 0
  const hours = hoursUntil(idea.funding_deadline)
  const isCritical = hours !== null && hours >= 0 && hours < 6
  const isUrgent   = hours !== null && hours >= 0 && hours < 24
  const isWarning  = hours !== null && hours >= 0 && hours >= 24 && hours <= 48
  const badge = STATUS_BADGE[idea.status]
  const isPreLive = ['submitted', 'under_review', 'awaiting_price', 'priced'].includes(idea.status)
  const appLabel = idea.app_number
    ? `#${String(idea.app_number).padStart(3, '0')}`
    : null

  const isLive     = idea.status === 'live'
  const isFunded   = idea.status === 'funded'
  const isBuilding = ['building', 'in_review'].includes(idea.status)
  const isExpired  = idea.status === 'expired'
  const isPledging = openPledge !== null

  const activeTier = PLEDGE_TIERS.find((t) => t.amountCents === openPledge?.amountCents)

  return (
    <div className="win95-window" style={{ maxWidth: '100%', ...(isLive && isCritical ? { outline: '2px solid #cc0000' } : {}) }}>
      {/* Title bar — always visible */}
      <div className="win95-title-bar" style={isExpired ? { background: '#808080' } : {}}>
        <Link
          href={`/fund/${idea.slug}`}
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
        >
          <span className="font-vt323 text-lg truncate flex-1">{idea.official_name ?? idea.title}</span>
          {idea.official_name && (
            <span
              className="hidden sm:inline text-xs flex-shrink-0 mx-1 px-1"
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                color: '#004400',
                background: '#c8ffc8',
                border: '1px solid #008000',
                whiteSpace: 'nowrap',
              }}
            >
              ✓ Named by the community
            </span>
          )}
          {appLabel && (
            <span
              className="text-xs flex-shrink-0 mx-1 px-1"
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                color: '#404040',
                background: '#e0e0e0',
                border: '1px solid #808080',
                whiteSpace: 'nowrap',
              }}
            >
              {appLabel}
            </span>
          )}
          {badge && (
            <span
              className="text-xs flex-shrink-0 mx-1 px-1"
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                color: badge.color,
                background: badge.bg,
                border: '1px solid currentColor',
                whiteSpace: 'nowrap',
              }}
            >
              {badge.label}
            </span>
          )}
        </Link>
        <div className="flex gap-1 flex-shrink-0">
          {[
            { ch: '_', action: () => setMinimized(true)  },
            { ch: '□', action: () => setMinimized(false) },
            { ch: '✕', action: () => {}                  },
          ].map(({ ch, action }) => (
            <button
              key={ch}
              type="button"
              onClick={(e) => { e.preventDefault(); action() }}
              className="win95-btn"
              style={{ minWidth: 16, padding: '0 6px', fontSize: 10, lineHeight: '16px', cursor: 'pointer' }}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {!minimized && (<>
      <Link
        href={`/fund/${idea.slug}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block', opacity: isExpired ? 0.8 : 1 }}
        className={isExpired ? '' : 'cursor-pointer hover:brightness-95'}
      >

        {/* Body */}
        <div className="p-3 space-y-2">
          {idea.official_name ? (
            <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
              working title: {idea.title}
            </div>
          ) : isPreLive ? (
            <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
              working title
            </div>
          ) : null}
          <p className="text-sm leading-snug" style={{ color: '#000' }}>
            {truncate(idea.goal_description, 100)}
          </p>

          {/* Progress / Momentum */}
          {isPreLive ? (
            <div className="win95-sunken p-2 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-vt323 text-2xl" style={{ color: '#000080' }}>
                  {formatDollars(idea.amount_raised)}
                </span>
                <span className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  pledged so far
                </span>
              </div>
              <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                {idea.backer_count > 0
                  ? `${idea.backer_count} ${idea.backer_count === 1 ? 'person' : 'people'} already in — build price coming soon`
                  : 'Be the first — build price set within 24hrs of approval'}
              </div>
            </div>
          ) : idea.build_price ? (
            <div className="space-y-1">
              <div className="win95-progress-track">
                <div className="win95-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                <span>{formatDollars(idea.amount_raised)} / {formatDollars(idea.build_price)}</span>
                <span className="font-bold" style={{ color: pct >= 100 ? 'green' : 'inherit' }}>{pct}%</span>
              </div>
            </div>
          ) : (
            <div className="win95-progress-track">
              <div className="win95-progress-fill" style={{ width: '0%' }} />
            </div>
          )}

          {/* Hosting meter for shipped apps */}
          {idea.status === 'built' && idea.hosting_monthly_goal > 0 && (() => {
            const hPct = progressPercent(idea.hosting_collected, idea.hosting_monthly_goal)
            const hColor = hPct >= 50 ? '#006600' : hPct >= 25 ? '#886600' : '#cc0000'
            const dayOfMonth = new Date().getDate()
            const isAtRisk = idea.hosting_status === 'warning' || idea.hosting_status === 'offline' ||
              (dayOfMonth >= 15 && hPct < 50)
            return (
              <div className="space-y-1">
                {isAtRisk && (
                  <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: 'darkred', fontWeight: 'bold' }}>
                    ⚠️ Hosting at risk this month
                  </div>
                )}
                <a
                  href={`/hosting/${idea.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div className="text-xs flex justify-between" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                    <span>{formatDollars(idea.hosting_collected)} of {formatDollars(idea.hosting_monthly_goal)}/mo</span>
                    <span style={{ color: hColor, fontWeight: 'bold' }}>{hPct}%</span>
                  </div>
                  <div className="win95-progress-track" style={{ height: 6 }}>
                    <div className="win95-progress-fill" style={{ width: `${hPct}%`, background: hColor }} />
                  </div>
                </a>
                <a
                  href={`/hosting/${idea.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs"
                  style={{ fontFamily: 'Share Tech Mono, monospace', color: '#000080', display: 'block', textAlign: 'right' }}
                >
                  Support Hosting →
                </a>
              </div>
            )
          })()}

          {/* Stats */}
          <div className="win95-sunken p-2 flex flex-wrap gap-3 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
            <span><span style={{ color: '#000080' }}>●</span> {idea.backer_count} backer{idea.backer_count !== 1 ? 's' : ''}</span>
            <span><span style={{ color: '#808080' }}>○</span> {idea.watcher_count} watcher{idea.watcher_count !== 1 ? 's' : ''}</span>
            {idea.status === 'built' ? (
              <span style={{ color: '#300060', fontWeight: 'bold' }}>🚀 SHIPD</span>
            ) : (isFunded || isBuilding) && hours !== null && hours > 0 ? (
              <span style={{ color: '#004000' }}>
                {isBuilding ? `Building — ${formatTimeLeft(hours)}` : `Build starts in ${formatTimeLeft(hours)}`}
              </span>
            ) : hours !== null && (
              hours > 0 && hours <= 2 && idea.funding_deadline
                ? <LiveCountdown deadline={idea.funding_deadline} />
                : <span style={{
                    color: (isCritical || isUrgent) ? 'darkred' : isWarning ? '#886600' : 'inherit',
                    fontWeight: (isCritical || isUrgent) ? 'bold' : 'inherit',
                  }}>
                    {hours > 0
                      ? `${isCritical || isUrgent || isWarning ? '⚠️ ' : ''}${formatTimeLeft(hours)} left`
                      : 'EXPIRED'}
                  </span>
            )}
            {idea.top_donor_name && (
              <span className="ml-auto">Top: <strong>{idea.top_donor_name}</strong></span>
            )}
          </div>
        </div>
      </Link>

      {/* Revive button — expired ideas */}
      {isExpired && (
        <div className="px-3 pb-3">
          <a
            href={`/submit?title=${encodeURIComponent(idea.title)}&description=${encodeURIComponent(idea.goal_description ?? '')}`}
            onClick={(e) => e.stopPropagation()}
            className="win95-btn text-xs"
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              fontFamily: 'Share Tech Mono, monospace',
              color: '#000080',
            }}
          >
            Revive This →
          </a>
        </div>
      )}

      {/* Pledge section — live and funded ideas */}
      {(isLive || isFunded) && (
        <div className="px-3 pb-3 space-y-2">

          {/* ── Success state ── */}
          {openPledge?.phase === 'success' ? (
            <div
              className="p-3 text-center"
              style={{
                background: '#d0ffd0',
                border: '2px solid',
                borderColor: '#008000 #004000 #004000 #008000',
                fontFamily: 'Share Tech Mono, monospace',
              }}
            >
              <div className="font-vt323 text-2xl" style={{ color: '#004000' }}>✓ Pledged!</div>
              <div className="text-xs" style={{ color: '#004000' }}>
                {formatDollars(openPledge.amountCents)} authorized — card held until goal is reached.
              </div>
            </div>

          ) : isPledging ? (
            /* ── Expanded pledge form ── */
            <div className="win95-sunken p-2 space-y-2" style={{ background: '#f8f8f8' }}>
              {/* Header row: selected tier label + X */}
              <div className="flex justify-between items-center">
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                  <span className="font-vt323" style={{ fontSize: 17, color: '#000080' }}>
                    {formatDollars(openPledge.amountCents)}
                  </span>
                  {activeTier && (
                    <span style={{ marginLeft: 6, opacity: 0.65 }}>— {activeTier.label}</span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: '16px',
                    padding: '0 6px',
                    background: '#c0c0c0',
                    color: '#000',
                    border: '2px solid',
                    borderColor: '#fff #808080 #808080 #fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Cancel"
                >
                  ✕
                </button>
              </div>

              {/* Loading */}
              {openPledge.phase === 'loading' && (
                <div className="text-xs text-center" style={{ fontFamily: 'Share Tech Mono, monospace', opacity: 0.6 }}>
                  ⌛ Preparing...
                </div>
              )}

              {/* API error (e.g. already pledged, idea expired) */}
              {openPledge.apiError && (
                <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: 'darkred' }}>
                  ⚠ {openPledge.apiError}
                </div>
              )}

              {/* Card form */}
              {openPledge.phase === 'card' && openPledge.clientSecret && (
                <InlinePledgeForm
                  clientSecret={openPledge.clientSecret}
                  amountCents={openPledge.amountCents}
                  onSuccess={onSuccess}
                />
              )}
            </div>

          ) : (
            /* ── Tier buttons ── */
            <>
              {isFunded && (
                <div className="text-xs text-center" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#004000' }}>
                  Funded ✓ — keep backing it
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {PLEDGE_TIERS.map(({ amountCents, dollars, label, perk }) => (
                  <button
                    key={amountCents}
                    type="button"
                    title={perk}
                    disabled={anyPledgeOpen}
                    onClick={() => onTierClick(amountCents)}
                    className="win95-btn win95-btn-primary"
                    style={{
                      textAlign: 'center',
                      padding: '4px 2px',
                      fontFamily: 'VT323, monospace',
                      fontSize: '0.95rem',
                      lineHeight: 1.2,
                      cursor: anyPledgeOpen ? 'default' : 'pointer',
                      ...(anyPledgeOpen ? { opacity: 0.4 } : {}),
                    }}
                  >
                    ${dollars.toLocaleString()}<br />
                    <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      </>)}
    </div>
  )
}

// ── Filter bar + grid ─────────────────────────────────────────────────────────

export function FeedFilter({ ideas, spotlight = null }: { ideas: IdeaWithTopDonor[]; spotlight?: SpotlightData | null }) {
  const router = useRouter()
  const [active, setActive] = useState<FilterKey>('pledges')
  const [search, setSearch] = useState('')
  const [openPledge, setOpenPledge] = useState<OpenPledge | null>(null)
  const [openSupport, setOpenSupport] = useState<OpenSupport | null>(null)

  const query = search.trim().toLowerCase()

  const filtered = ideas
    .filter((idea) => {
      if (active === 'unfunded') return EXPIRED_STATUSES.includes(idea.status)
      if (EXPIRED_STATUSES.includes(idea.status)) return false
      if (active === 'all') return true
      const f = MAIN_FILTERS.find((f) => f.key === active)
      return f?.statuses?.includes(idea.status) ?? true
    })
    .filter((idea) => !query || idea.title.toLowerCase().includes(query) || (idea.official_name?.toLowerCase().includes(query) ?? false))

  async function startPledge(idea: IdeaWithTopDonor, amountCents: number) {
    if (openPledge !== null) return
    // Immediately open the card in loading state (collapses any other open card)
    setOpenSupport(null)
    setOpenPledge({ ideaId: idea.id, amountCents, phase: 'loading', clientSecret: null, apiError: null })

    const tier = PLEDGE_TIERS.find((t) => t.amountCents === amountCents)

    const res = await fetch('/api/pledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_idea_id: idea.id,
        amount: amountCents,
        type: tier?.type ?? 'pledge',
      }),
    })

    if (res.status === 401) {
      router.push('/login?redirectTo=/')
      setOpenPledge(null)
      return
    }

    const json = await res.json()

    if (!res.ok) {
      setOpenPledge((prev) =>
        prev?.ideaId === idea.id
          ? { ...prev, phase: 'card', apiError: json.error ?? 'Something went wrong.' }
          : prev
      )
      return
    }

    setOpenPledge((prev) =>
      prev?.ideaId === idea.id
        ? { ...prev, phase: 'card', clientSecret: json.client_secret, apiError: null }
        : prev
    )
  }

  function handleSuccess() {
    setOpenPledge((prev) => (prev ? { ...prev, phase: 'success' } : prev))
    setTimeout(() => {
      setOpenPledge(null)
      router.refresh()
    }, 2000)
  }

  async function startSupport(amountCents: number) {
    setOpenPledge(null)
    setOpenSupport({ amountCents, phase: 'loading', clientSecret: null, apiError: null })

    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountCents, mode: 'one_time' }),
    })

    if (res.status === 401) {
      router.push('/login?redirectTo=/')
      setOpenSupport(null)
      return
    }

    const json = await res.json()

    if (!res.ok) {
      setOpenSupport((prev) =>
        prev ? { ...prev, phase: 'card', apiError: json.error ?? 'Something went wrong.' } : prev
      )
      return
    }

    setOpenSupport((prev) =>
      prev ? { ...prev, phase: 'card', clientSecret: json.client_secret, apiError: null } : prev
    )
  }

  function handleSupportSuccess() {
    setOpenSupport((prev) => (prev ? { ...prev, phase: 'success' } : prev))
    setTimeout(() => setOpenSupport(null), 2500)
  }

  return (
    <Elements stripe={stripePromise}>
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">Filter</span>
          </div>
          <div className="p-2 space-y-2">
            <input
              type="search"
              className="win95-input w-full"
              placeholder="Search ideas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {MAIN_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActive(f.key)}
                  className="win95-btn text-xs"
                  style={
                    active === f.key
                      ? { background: '#000080', color: '#fff', borderColor: '#000040 #8080ff #8080ff #000040' }
                      : {}
                  }
                >
                  {f.label}
                  {f.statuses && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      ({ideas.filter((i) => f.statuses!.includes(i.status)).length})
                    </span>
                  )}
                </button>
              ))}
              {/* Separator */}
              <div style={{ width: 1, background: '#808080', alignSelf: 'stretch', margin: '0 4px' }} />
              {/* Unfunded — visually separated */}
              <button
                onClick={() => setActive('unfunded')}
                className="win95-btn text-xs"
                style={
                  active === 'unfunded'
                    ? { background: '#606060', color: '#fff', borderColor: '#404040 #a0a0a0 #a0a0a0 #404040' }
                    : { color: '#606060' }
                }
              >
                Unfunded
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  ({ideas.filter((i) => EXPIRED_STATUSES.includes(i.status)).length})
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 && active !== 'pledges' ? (
          <div className="win95-window max-w-lg mx-auto">
            <div className="win95-title-bar">
              <span className="font-vt323 text-lg">No Results</span>
            </div>
            <div className="p-6 text-center text-sm">
              {query ? `No ideas matching "${search}".` : 'Nothing in this category yet.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active === 'pledges' && (
              <ShipditCard
                openSupport={openSupport}
                spotlight={spotlight}
                onTierClick={startSupport}
                onClose={() => setOpenSupport(null)}
                onSuccess={handleSupportSuccess}
              />
            )}
            {filtered.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                openPledge={openPledge?.ideaId === idea.id ? openPledge : null}
                anyPledgeOpen={openPledge !== null}
                onTierClick={(amountCents) => startPledge(idea, amountCents)}
                onClose={() => setOpenPledge(null)}
                onSuccess={handleSuccess}
              />
            ))}
          </div>
        )}
      </div>
    </Elements>
  )
}
