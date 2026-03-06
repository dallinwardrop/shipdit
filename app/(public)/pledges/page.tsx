export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDollars, progressPercent } from '@/lib/utils'

type PledgeRow = {
  id: string
  amount: number
  type: string
  status: string
  created_at: string
  app_idea_id: string
}

type IdeaRow = {
  id: string
  title: string
  slug: string | null
  app_number: number | null
  build_price: number | null
  amount_raised: number
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  held:      { label: 'AUTHORIZED', bg: '#fff8c0', color: '#886600' },
  captured:  { label: 'CHARGED',    bg: '#c0ffc0', color: '#004000' },
  refunded:  { label: 'REFUNDED',   bg: '#e8e8e8', color: '#404040' },
  failed:    { label: 'FAILED',     bg: '#ffc0c0', color: '#800000' },
  pending:   { label: 'PENDING',    bg: '#c0d0ff', color: '#000080' },
}

function pledgeLabel(type: string, amount: number): string {
  if (type === 'watch') return 'Watcher'
  if (amount >= 500000) return 'Legend'
  if (amount >= 100000) return 'Patron'
  if (amount >= 50000)  return 'Backer'
  if (amount >= 10000)  return 'Supporter'
  return 'Backer'
}

export default async function PledgesPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) redirect('/login?redirectTo=/pledges')

  const admin = createAdminClient()

  const { data: pledgeRows } = await admin
    .from('pledges')
    .select('id, amount, type, status, created_at, app_idea_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const pledges = (pledgeRows ?? []) as PledgeRow[]

  // Fetch ideas in one query
  const ideaIds = [...new Set(pledges.map((p) => p.app_idea_id))]
  const ideaMap: Record<string, IdeaRow> = {}

  if (ideaIds.length > 0) {
    const { data: ideaRows } = await admin
      .from('app_ideas')
      .select('id, title, slug, app_number, build_price, amount_raised')
      .in('id', ideaIds)
    for (const idea of ideaRows ?? []) {
      ideaMap[idea.id] = idea as IdeaRow
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">My Pledges</span>
          <span className="text-xs opacity-70 ml-2">({pledges.length})</span>
        </div>

        {pledges.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="font-vt323 text-3xl" style={{ color: '#808080' }}>
              No pledges yet
            </div>
            <p className="text-sm" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
              You haven&apos;t backed any ideas yet.{' '}
              Browse the fund queue to find something worth building.
            </p>
            <Link href="/" className="win95-btn text-sm inline-block mt-2">
              Browse the Fund Queue →
            </Link>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {pledges.map((pledge) => {
              const idea = ideaMap[pledge.app_idea_id]
              const appLabel = idea?.app_number
                ? `App #${String(idea.app_number).padStart(3, '0')}`
                : 'App Pending'
              const pct = idea?.build_price && idea.amount_raised
                ? progressPercent(idea.amount_raised, idea.build_price)
                : 0
              const badge = STATUS_BADGE[pledge.status] ?? STATUS_BADGE.pending

              return (
                <div
                  key={pledge.id}
                  className="win95-raised p-3 space-y-2"
                  style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}
                >
                  {/* Top row */}
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    {/* App name */}
                    <div className="space-y-0.5 min-w-0">
                      {idea?.slug ? (
                        <Link
                          href={`/fund/${idea.slug}`}
                          className="font-vt323 hover:underline"
                          style={{ fontSize: 18, color: '#000080', display: 'block' }}
                        >
                          {idea.title}
                        </Link>
                      ) : (
                        <span className="font-vt323" style={{ fontSize: 18, color: '#404040' }}>
                          {idea?.title ?? 'Unknown'}
                        </span>
                      )}
                      <div style={{ opacity: 0.6, fontSize: 11 }}>{appLabel}</div>
                    </div>

                    {/* Right side: amount + badge */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="font-vt323" style={{ fontSize: 20, color: '#000080' }}>
                          {formatDollars(pledge.amount)}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {pledgeLabel(pledge.type, pledge.amount)}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 'bold',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.color}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {idea?.build_price && (
                    <div className="space-y-1">
                      <div className="win95-progress-track" style={{ height: 10 }}>
                        <div className="win95-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between" style={{ fontSize: 11, opacity: 0.7 }}>
                        <span>
                          {formatDollars(idea.amount_raised)} of {formatDollars(idea.build_price)} goal
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div style={{ fontSize: 11, opacity: 0.5 }}>
                    Pledged {new Date(pledge.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
