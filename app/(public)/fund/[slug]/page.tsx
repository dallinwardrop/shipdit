export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDollars, progressPercent, daysUntil } from '@/lib/utils'
import { PledgeBox, PriorityTag } from './PledgeBox'
import type { FeatureItem } from '@/lib/supabase/types'

type BackerRow = {
  amount: number
  type: string
  user_id: string
  anonymous: boolean
}

type Backer = BackerRow & { displayName: string }

export default async function FundIdeaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: idea } = await supabase
    .from('app_ideas')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!idea) notFound()

  const { data: backerRows } = await supabase
    .from('pledges')
    .select('amount, type, user_id, anonymous')
    .eq('app_idea_id', idea.id)
    .in('status', ['held', 'captured'])
    .order('amount', { ascending: false })
    .limit(20)

  const rows = (backerRows ?? []) as BackerRow[]

  // Fetch names for non-anonymous backers
  const namedIds = [...new Set(rows.filter((r) => !r.anonymous).map((r) => r.user_id))]
  const nameMap: Record<string, string> = {}
  if (namedIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', namedIds)
    for (const u of userRows ?? []) {
      nameMap[u.id] = (u.full_name as string | null)?.split(' ')[0] ?? 'Anonymous'
    }
  }

  const backers: Backer[] = rows.map((r) => ({
    ...r,
    displayName: r.anonymous ? 'Anonymous' : (nameMap[r.user_id] ?? 'Anonymous'),
  }))

  const pct = idea.build_price ? progressPercent(idea.amount_raised, idea.build_price) : 0
  const days = daysUntil(idea.funding_deadline)
  const features = (idea.features ?? []) as FeatureItem[]
  const PLEDGE_OPEN = ['submitted', 'under_review', 'awaiting_price', 'priced', 'live']
  const isPledgeOpen = PLEDGE_OPEN.includes(idea.status)
  const PRE_LIVE    = ['submitted', 'under_review', 'awaiting_price']
  const LIVE_PRICED = ['live', 'priced']
  const isPreLive   = PRE_LIVE.includes(idea.status)
  const isLivePriced = LIVE_PRICED.includes(idea.status)
  const appLabel = idea.app_number
    ? `App #${String(idea.app_number).padStart(3, '0')}`
    : null
  const titleBarText = (isLivePriced && appLabel) ? appLabel : idea.title

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex gap-4 items-start">

        {/* ── Left column (65%) ── */}
        <div className="space-y-4" style={{ flex: '0 0 65%', minWidth: 0 }}>

          {/* Header */}
          <div className="win95-window">
            <div className="win95-title-bar">
              <span className="font-vt323 text-xl truncate">{titleBarText}</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h1 className="font-vt323 text-5xl leading-tight" style={{ color: '#000080' }}>
                  {titleBarText}
                </h1>
                {isPreLive ? (
                  <div className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
                    {idea.title} <span style={{ opacity: 0.7 }}>(working title)</span>
                  </div>
                ) : (isLivePriced && appLabel) ? (
                  <div className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
                    {idea.title} <span style={{ opacity: 0.7 }}>(working title)</span>
                  </div>
                ) : null}
              </div>

              {/* Meta */}
              <div className="win95-sunken p-2 flex flex-wrap gap-4 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                <span>For: <strong>{idea.target_user}</strong></span>
                <span>Platform: <strong>{idea.platform_preference}</strong></span>
                {idea.similar_apps && <span>Similar to: <strong>{idea.similar_apps}</strong></span>}
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed">{idea.goal_description}</p>

              {/* Progress */}
              {idea.build_price ? (
                <div className="space-y-1">
                  <div className="win95-progress-track">
                    <div className="win95-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                    <span>
                      {formatDollars(idea.amount_raised)} raised of {formatDollars(idea.build_price)} goal
                    </span>
                    <span style={{ color: pct >= 100 ? 'green' : 'inherit' }}>
                      {pct}% funded
                    </span>
                  </div>
                </div>
              ) : (
                <div className="win95-sunken p-2 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  Goal: TBD — price being set by the builder
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="win95-raised p-2 text-center">
                  <div className="font-vt323 text-3xl" style={{ color: '#000080' }}>{idea.backer_count}</div>
                  <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>Backers</div>
                </div>
                <div className="win95-raised p-2 text-center">
                  <div className="font-vt323 text-3xl" style={{ color: '#000080' }}>{idea.watcher_count}</div>
                  <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>Watchers</div>
                </div>
                <div className="win95-raised p-2 text-center">
                  <div className="font-vt323 text-3xl" style={{ color: days !== null && days <= 7 ? 'darkred' : '#000080' }}>
                    {days === null ? '∞' : days <= 0 ? 'ENDED' : `${days}d`}
                  </div>
                  <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>Days Left</div>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          {features.length > 0 && (
            <div className="win95-window">
              <div className="win95-title-bar">
                <span className="font-vt323 text-lg">Feature Scope</span>
              </div>
              <div className="p-3 space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="win95-sunken p-2 flex gap-3 items-start text-sm">
                    <PriorityTag priority={f.priority} />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backer wall */}
          {backers.length > 0 && (
            <div className="win95-window">
              <div className="win95-title-bar">
                <span className="font-vt323 text-lg">Backer Wall</span>
              </div>
              <div className="p-3 space-y-1">
                {backers.map((b, i) => (
                  <div key={i} className="win95-raised p-2 flex justify-between items-center text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                    <span>{i === 0 && '★ '}<strong>{b.displayName}</strong></span>
                    <span>{formatDollars(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column (35%) — sticky ── */}
        <div style={{ flex: '0 0 35%', minWidth: 0, position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
          {isPledgeOpen ? (
            <PledgeBox appIdeaId={idea.id} slug={slug} />
          ) : (
            <div className="win95-window">
              <div className="win95-title-bar">
                <span className="font-vt323 text-lg">Status</span>
              </div>
              <div className="p-3 text-sm" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                {idea.status === 'funded'   && '✓ Fully funded! Build starting soon.'}
                {idea.status === 'building' && '🔨 Build in progress.'}
                {idea.status === 'in_review' && '🔍 Build complete — in final review.'}
                {idea.status === 'built'    && '🚀 Shipped! This app is live for everyone.'}
                {idea.demo_url && (
                  <a href={idea.demo_url} target="_blank" rel="noopener noreferrer" className="win95-btn inline-block mt-2 text-xs">
                    View Demo →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
