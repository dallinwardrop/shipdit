export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { PledgeLedger } from './PledgeLedger'
import type { PledgeLedgerRow } from './PledgeLedger'

export default async function PledgesPage() {
  const admin = createAdminClient()

  const { data: pledges } = await admin
    .from('pledges')
    .select('id, amount, type, status, stripe_payment_intent_id, is_submitter_pledge, created_at, captured_at, refunded_at, app_ideas(title, slug), users(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

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

      <PledgeLedger pledges={(pledges ?? []) as unknown as PledgeLedgerRow[]} />
    </div>
  )
}
