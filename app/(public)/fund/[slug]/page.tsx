export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDollars, progressPercent, hoursUntil, formatTimeLeft } from '@/lib/utils'
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
  const hours = hoursUntil(idea.funding_deadline)
  const features = (idea.features ?? []) as FeatureItem[]
  const PLEDGE_OPEN = ['submitted', 'under_review', 'awaiting_price', 'priced', 'live']
  const isPledgeOpen = PLEDGE_OPEN.includes(idea.status)
  const isPreLive = ['submitted', 'under_review', 'awaiting_price'].includes(idea.status)
  const isBuilt = idea.status === 'built'
  const appLabel = idea.app_number
    ? `#${String(idea.app_number).padStart(3, '0')}`
    : null

  const hGoal = (idea.hosting_monthly_goal as number | null) ?? 0
  const hCollected = (idea.hosting_collected as number | null) ?? 0
  const hPct = hGoal > 0 ? progressPercent(hCollected, hGoal) : 0
  const hColor = hPct >= 50 ? '#006600' : hPct >= 25 ? '#886600' : '#cc0000'

  return (
    <div className="max-w-5xl mx-auto">
      <div className={isBuilt ? 'space-y-4' : 'flex flex-col md:flex-row gap-4 md:items-start'}>

        {/* ── Main / left column ── */}
        <div className={`space-y-4 min-w-0${isBuilt ? '' : ' w-full md:w-[65%] md:flex-none'}`}>

          {/* Header */}
          <div className="win95-window">
            <div className="win95-title-bar">
              <span className="font-vt323 text-xl truncate flex-1">{idea.title}</span>
              {appLabel && (
                <span
                  className="text-xs flex-shrink-0 ml-2 px-1"
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
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h1 className="font-vt323 text-5xl leading-tight" style={{ color: '#000080' }}>
                  {idea.title}
                </h1>
                {isPreLive && (
                  <div className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
                    working title
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="win95-sunken p-2 flex flex-wrap gap-4 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                <span>For: <strong>{idea.target_user}</strong></span>
                <span>Platform: <strong>{idea.platform_preference}</strong></span>
                {idea.similar_apps && <span>Similar to: <strong>{idea.similar_apps}</strong></span>}
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed">{idea.goal_description}</p>

              {/* Progress / Momentum */}
              {isPreLive ? (
                <div className="win95-sunken p-3 space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-vt323 text-4xl" style={{ color: '#000080' }}>
                      {formatDollars(idea.amount_raised)}
                    </span>
                    <span className="text-sm" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                      pledged so far
                    </span>
                  </div>
                  <div className="text-xs leading-relaxed" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                    {idea.backer_count > 0
                      ? `${idea.backer_count} ${idea.backer_count === 1 ? 'person is' : 'people are'} already in. Build price will be set within 24hrs of approval — your pledge is held until then.`
                      : 'Be the first backer. Build price will be set within 24hrs of approval — your pledge is held, never charged unless the goal is hit.'}
                  </div>
                </div>
              ) : idea.build_price ? (
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
              ) : null}

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
                  <div className="font-vt323 text-3xl" style={{ color: idea.status === 'built' ? '#300060' : hours !== null && hours <= 24 ? 'darkred' : '#000080' }}>
                    {idea.status === 'built' ? 'SHIPD' : formatTimeLeft(hours)}
                  </div>
                  <div className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>Time Left</div>
                </div>
              </div>
            </div>
          </div>

          {/* Build Guarantee panel — funded or building */}
          {(idea.status === 'funded' || idea.status === 'building') && (
            <div className="win95-window">
              <div className="win95-title-bar" style={{ background: '#004000' }}>
                <span className="font-vt323 text-lg">🛡️ Build Guarantee</span>
              </div>
              <div className="p-4 space-y-2" style={{ background: '#f0fff0' }}>
                <p className="font-vt323text-xl" style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, fontWeight: 'bold', color: '#004000' }}>
                  {idea.status === 'funded'
                    ? '✓ Fully funded — build starts within 72 hours.'
                    : '🔨 Build is in progress — shipping within 72 hours of funding.'}
                </p>
                <p className="text-xs leading-relaxed" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  Once funding is complete and payments are captured, a working MVP is guaranteed to be delivered within <strong>72 hours</strong>.
                  If the app is not delivered in time, every backer receives a <strong>full automatic refund</strong> — no questions asked.
                </p>
              </div>
            </div>
          )}

          {/* Hosting panel — full-width layout for built apps */}
          {isBuilt && (
            <div className="win95-window">
              <div className="win95-title-bar">
                <span className="font-vt323 text-lg">Keep this app free</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  Community contributions cover server costs and keep this app free for everyone.
                </p>

                {hGoal > 0 ? (
                  <div className="space-y-2">
                    <div className="win95-progress-track">
                      <div className="win95-progress-fill" style={{ width: `${hPct}%`, background: hColor }} />
                    </div>
                    <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                      <span>{formatDollars(hCollected)} of {formatDollars(hGoal)} this month</span>
                      <span style={{ fontWeight: 'bold', color: hColor }}>{hPct}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="win95-sunken p-2 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                    Hosting goal not yet set.
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {idea.demo_url && (
                    <a
                      href={idea.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="win95-btn text-xs"
                      style={{ padding: '6px 12px' }}
                    >
                      Launch App →
                    </a>
                  )}
                  <a
                    href={`/hosting/${slug}`}
                    className="win95-btn win95-btn-primary text-xs"
                    style={{ padding: '6px 12px', fontFamily: 'VT323, monospace', fontSize: '1rem' }}
                  >
                    💙 Support Hosting
                  </a>
                </div>
              </div>
            </div>
          )}

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

        {/* ── Right column (35%) — sticky — hidden for built apps ── */}
        {!isBuilt && (
          <div className="w-full md:w-[35%] md:flex-none min-w-0 md:sticky md:top-4 md:self-start">
            {isPledgeOpen ? (
              <PledgeBox appIdeaId={idea.id} slug={slug} fundingDeadline={idea.funding_deadline} />
            ) : (
              <div className="win95-window">
                <div className="win95-title-bar">
                  <span className="font-vt323 text-lg">Status</span>
                </div>
                <div className="p-3 text-sm space-y-2" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                  {idea.status === 'funded'   && '✓ Fully funded! Build starting soon.'}
                  {idea.status === 'building' && '🔨 Build in progress.'}
                  {idea.status === 'in_review' && '🔍 Build complete — in final review.'}
                  {idea.demo_url && (
                    <a href={idea.demo_url} target="_blank" rel="noopener noreferrer" className="win95-btn inline-block mt-2 text-xs">
                      View Demo →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
