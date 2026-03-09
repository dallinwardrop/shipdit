'use client'

import { useState } from 'react'
import { formatDollars } from '@/lib/utils'
import { CapturePledgeButton } from './CapturePledgeButton'
import { ReleasePledgeButton } from './ReleasePledgeButton'

export type PledgeLedgerRow = {
  id: string
  amount: number
  type: string
  status: string
  stripe_payment_intent_id: string | null
  is_submitter_pledge: boolean
  created_at: string
  captured_at: string | null
  refunded_at: string | null
  app_ideas: { title: string; slug: string } | null
  users: { email: string; full_name: string | null } | null
}

const STATUS_COLORS: Record<string, string> = {
  held:       '#006600',
  authorized: '#006600',
  captured:   '#000080',
  pending:    '#404040',
  refunded:   '#800000',
  failed:     'darkred',
  cancelled:  '#808080',
}

type FilterKey = 'all' | 'held' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'cancelled'

const FILTERS: FilterKey[] = ['all', 'held', 'authorized', 'captured', 'refunded', 'failed', 'cancelled']

const STAT_BOXES: {
  label: string
  statuses: string[]
  clickFilter: FilterKey
  activeOn: FilterKey[]
}[] = [
  { label: 'Total Held',     statuses: ['held', 'authorized'], clickFilter: 'held',     activeOn: ['held', 'authorized'] },
  { label: 'Total Captured', statuses: ['captured'],           clickFilter: 'captured', activeOn: ['captured'] },
  { label: 'Total Refunded', statuses: ['refunded'],           clickFilter: 'refunded', activeOn: ['refunded'] },
  { label: 'Total Failed',   statuses: ['failed'],             clickFilter: 'failed',   activeOn: ['failed'] },
  { label: 'Grand Total',    statuses: [],                     clickFilter: 'all',      activeOn: ['all'] },
]

const btnBase: React.CSSProperties = {
  fontFamily: 'Share Tech Mono, monospace',
  fontSize: 11,
  cursor: 'pointer',
  padding: '2px 10px',
  border: '2px solid',
  borderColor: '#fff #808080 #808080 #fff',
  background: '#c0c0c0',
  color: '#000',
}
const btnActive: React.CSSProperties = {
  ...btnBase,
  background: '#000080',
  color: '#fff',
  borderColor: '#000040 #8080ff #8080ff #000040',
}

export function PledgeLedger({ pledges }: { pledges: PledgeLedgerRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  // Totals computed client-side
  function sumBy(statuses: string[]): number {
    const set = new Set(statuses)
    return pledges
      .filter((p) => (set.size === 0 ? true : set.has(p.status)))
      .reduce((s, p) => s + p.amount, 0)
  }

  const grandTotal = pledges.reduce((s, p) => s + p.amount, 0)

  const filtered = filter === 'all' ? pledges : pledges.filter((p) => p.status === filter)

  return (
    <div className="space-y-3">
      {/* ── Stat boxes ── */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-base">Totals ({pledges.length} pledges)</span>
        </div>
        <div className="p-2 flex flex-wrap gap-2">
          {STAT_BOXES.map((box) => {
            const amount = box.statuses.length === 0 ? grandTotal : sumBy(box.statuses)
            const isActive = box.activeOn.includes(filter)
            return (
              <button
                key={box.label}
                onClick={() => setFilter(box.clickFilter)}
                style={{
                  fontFamily: 'Share Tech Mono, monospace',
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  border: '2px solid',
                  background: isActive ? '#000080' : '#c0c0c0',
                  color: isActive ? '#fff' : '#000',
                  borderColor: isActive
                    ? '#000040 #8080ff #8080ff #000040'
                    : '#fff #808080 #808080 #fff',
                  minWidth: 110,
                }}
              >
                <div style={{ fontSize: 10, opacity: 0.75 }}>{box.label}</div>
                <div className="font-vt323" style={{ fontSize: 22 }}>{formatDollars(amount)}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filter tabs + table ── */}
      <div className="win95-window">
        {/* Filter tabs */}
        <div className="p-2 flex flex-wrap gap-1" style={{ borderBottom: '1px solid #808080' }}>
          {FILTERS.map((f) => {
            const count = f === 'all' ? pledges.length : pledges.filter((p) => p.status === f).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={filter === f ? btnActive : btnBase}
              >
                {f.toUpperCase()} ({count})
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="p-2 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'Share Tech Mono, monospace' }}>
            <thead>
              <tr className="win95-raised">
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Idea</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-center">Type</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pledge, idx) => (
                <tr key={pledge.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f0f0f0' }}>
                  <td className="p-2">{pledge.users?.full_name ?? pledge.users?.email ?? '—'}</td>
                  <td className="p-2">
                    {pledge.app_ideas ? (
                      <a href={`/fund/${pledge.app_ideas.slug}`} style={{ color: '#000080' }}>
                        {pledge.app_ideas.title}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="p-2 text-right font-bold">{formatDollars(pledge.amount)}</td>
                  <td className="p-2 text-center">{pledge.type}</td>
                  <td className="p-2 text-center">
                    <span style={{ color: STATUS_COLORS[pledge.status] ?? '#000', fontWeight: 'bold', fontSize: 10 }}>
                      {pledge.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2">{new Date(pledge.created_at).toLocaleDateString('en-US')}</td>
                  <td className="p-2" style={{ display: 'flex', gap: 4 }}>
                    {pledge.status === 'authorized' && pledge.app_ideas && (
                      <CapturePledgeButton pledgeId={pledge.id} appTitle={pledge.app_ideas.title} />
                    )}
                    {pledge.status === 'held' && pledge.app_ideas && (
                      <ReleasePledgeButton pledgeId={pledge.id} appTitle={pledge.app_ideas.title} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div
              className="text-center py-8 text-xs"
              style={{ fontFamily: 'Share Tech Mono, monospace', opacity: 0.5 }}
            >
              No {filter === 'all' ? '' : filter.toUpperCase() + ' '}pledges.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
