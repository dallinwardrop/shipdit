'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDollars, progressPercent, daysUntil, truncate } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type AppIdea = Database['public']['Tables']['app_ideas']['Row']
export type IdeaWithTopDonor = AppIdea & { top_donor_name: string | null }

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  submitted:      { label: 'PENDING REVIEW',     color: '#404040', bg: '#d4d4d4' },
  under_review:   { label: 'PENDING REVIEW',     color: '#404040', bg: '#d4d4d4' },
  awaiting_price: { label: 'AWAITING PRICE',     color: '#664400', bg: '#fff0c0' },
  priced:         { label: 'ACCEPTING PLEDGES',  color: '#003300', bg: '#c0ffc0' },
  live:           { label: 'ACCEPTING PLEDGES',  color: '#003300', bg: '#c0ffc0' },
  funded:         { label: 'FUNDED',             color: '#000060', bg: '#c0c8ff' },
  building:       { label: 'BEING BUILT',        color: '#000060', bg: '#c0c8ff' },
  in_review:      { label: 'BEING BUILT',        color: '#000060', bg: '#c0c8ff' },
  built:          { label: 'SHIPPED',            color: '#300060', bg: '#e8c0ff' },
}

// ── Filter definitions ────────────────────────────────────────────────────────

type FilterKey = 'all' | 'pending' | 'pledges' | 'funded' | 'built'

const FILTERS: { key: FilterKey; label: string; statuses: string[] | null }[] = [
  { key: 'all',     label: 'All',               statuses: null },
  { key: 'pending', label: 'Pending Review',     statuses: ['submitted', 'under_review', 'awaiting_price'] },
  { key: 'pledges', label: 'Accepting Pledges',  statuses: ['priced', 'live'] },
  { key: 'funded',  label: 'Funded',             statuses: ['funded', 'building', 'in_review'] },
  { key: 'built',   label: 'Shipped',             statuses: ['built'] },
]

// ── Card ──────────────────────────────────────────────────────────────────────

function IdeaCard({ idea }: { idea: IdeaWithTopDonor }) {
  const pct = idea.build_price ? progressPercent(idea.amount_raised, idea.build_price) : 0
  const days = daysUntil(idea.funding_deadline)
  const isExpiringSoon = days !== null && days <= 14 && days >= 0
  const badge = STATUS_BADGE[idea.status]
  const PRE_LIVE   = ['submitted', 'under_review', 'awaiting_price']
  const LIVE_PRICED = ['live', 'priced']
  const isPreLive   = PRE_LIVE.includes(idea.status)
  const isLivePriced = LIVE_PRICED.includes(idea.status)
  const appLabel = idea.app_number
    ? `App #${String(idea.app_number).padStart(3, '0')}`
    : null
  // Title bar text: "App #001" when live/priced+app_number, otherwise the idea title
  const titleBarText = (isLivePriced && appLabel) ? appLabel : idea.title

  return (
    <Link href={`/fund/${idea.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="win95-window cursor-pointer hover:brightness-95 transition-all" style={{ maxWidth: '100%' }}>

        {/* Title bar */}
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg truncate flex-1">{titleBarText}</span>
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
          {/* Subtitle: working title label in relevant states */}
          {isPreLive ? (
            // Pre-live: title is shown in title bar, just add the label
            <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
              working title
            </div>
          ) : (isLivePriced && appLabel) ? (
            // Live/priced with app number: show idea title as "working title" subtitle
            <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
              {idea.title} <span style={{ opacity: 0.7 }}>(working title)</span>
            </div>
          ) : null}
          <p className="text-sm leading-snug" style={{ color: '#000' }}>
            {truncate(idea.goal_description, 100)}
          </p>

          {/* Progress */}
          {idea.build_price ? (
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

          {/* Stats */}
          <div className="win95-sunken p-2 flex flex-wrap gap-3 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
            <span><span style={{ color: '#000080' }}>●</span> {idea.backer_count} backer{idea.backer_count !== 1 ? 's' : ''}</span>
            <span><span style={{ color: '#808080' }}>○</span> {idea.watcher_count} watcher{idea.watcher_count !== 1 ? 's' : ''}</span>
            {days !== null && (
              <span style={{ color: isExpiringSoon ? 'darkred' : 'inherit' }}>
                {days > 0 ? `${days}d left` : days === 0 ? 'LAST DAY' : 'EXPIRED'}
              </span>
            )}
            {idea.top_donor_name && (
              <span className="ml-auto">Top: <strong>{idea.top_donor_name}</strong></span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Filter bar + grid ─────────────────────────────────────────────────────────

export function FeedFilter({ ideas }: { ideas: IdeaWithTopDonor[] }) {
  const [active, setActive] = useState<FilterKey>('all')

  const filtered = active === 'all'
    ? ideas
    : ideas.filter((idea) => {
        const f = FILTERS.find((f) => f.key === active)
        return f?.statuses?.includes(idea.status) ?? true
      })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">Filter</span>
        </div>
        <div className="p-2 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
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
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="win95-window max-w-lg mx-auto">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">No Results</span>
          </div>
          <div className="p-6 text-center text-sm">Nothing in this category yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  )
}
