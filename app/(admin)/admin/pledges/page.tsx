export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { formatDollars } from '@/lib/utils'
import { PledgeLedger } from './PledgeLedger'
import type { PledgeLedgerRow } from './PledgeLedger'

function sumByStatus(pledges: { amount: number; status: string }[], status: string) {
  const matching = pledges.filter((p) => p.status === status)
  return { count: matching.length, total: matching.reduce((s, p) => s + p.amount, 0) }
}

export default async function PledgesPage() {
  const admin = createAdminClient()

  const { data: pledges } = await admin
    .from('pledges')
    .select('id, amount, type, status, stripe_payment_intent_id, is_submitter_pledge, created_at, captured_at, refunded_at, app_ideas(title, slug), users(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = pledges ?? []
  const held     = sumByStatus(rows, 'held')
  const captured = sumByStatus(rows, 'captured')
  const refunded = sumByStatus(rows, 'refunded')
  const failed   = sumByStatus(rows, 'failed')
  const grand    = { count: rows.length, total: rows.reduce((s, p) => s + p.amount, 0) }

  const statBoxes = [
    { label: 'Total Held',     color: '#000080', bg: '#e0e8ff', ...held     },
    { label: 'Total Captured', color: '#004400', bg: '#d0ffd0', ...captured },
    { label: 'Total Refunded', color: '#804000', bg: '#fff0c0', ...refunded },
    { label: 'Total Failed',   color: '#880000', bg: '#ffe0e0', ...failed   },
    { label: 'Grand Total',    color: '#000000', bg: '#e0e0e0', ...grand    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Pledges</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>
            ALL PLEDGES
          </h1>
        </div>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statBoxes.map((box) => (
          <div
            key={box.label}
            className="win95-raised p-3 text-center"
            style={{ background: box.bg }}
          >
            <div className="font-vt323 text-2xl" style={{ color: box.color }}>
              {formatDollars(box.total)}
            </div>
            <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: box.color, opacity: 0.8 }}>
              {box.count} pledge{box.count !== 1 ? 's' : ''}
            </div>
            <div className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
              {box.label}
            </div>
          </div>
        ))}
      </div>

      <PledgeLedger pledges={(pledges ?? []) as unknown as PledgeLedgerRow[]} />
    </div>
  )
}
