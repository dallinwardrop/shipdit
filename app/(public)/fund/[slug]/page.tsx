export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { formatDollars, progressPercent, hoursUntil, formatTimeLeft } from '@/lib/utils'
import { PledgeBox, PriorityTag } from './PledgeBox'
import type { FeatureItem } from '@/lib/supabase/types'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: idea } = await supabase
    .from('app_ideas')
    .select('title, goal_description, official_name')
    .eq('slug', slug)
    .single()

  if (!idea) return {}

  const displayTitle = idea.official_name ?? idea.title
  const description = (idea.goal_description ?? '').slice(0, 160)
  return {
    title: `${displayTitle} — Fund This App on Shipdit`,
    description,
    openGraph: {
      title: `${displayTitle} — Fund This App on Shipdit`,
      description,
      images: [{ url: '/og-default.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayTitle} — Fund This App on Shipdit`,
      description,
    },
  }
}

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
  const serverClient = await createClient()
  const { data: { user: currentUser } } = await serverClient.auth.getUser()
  const currentUserId = currentUser?.id ?? null

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

  // Aggregate pledges by user to find top 2 unique backers for perks
  const userTotals: Record<string, { userId: string; total: number; displayName: string }> = {}
  for (const b of backers) {
    if (!userTotals[b.user_id]) {
      userTotals[b.user_id] = { userId: b.user_id, total: 0, displayName: b.displayName }
    }
    userTotals[b.user_id].total += b.amount
  }
  const topBackers = Object.values(userTotals).sort((a, b) => b.total - a.total).slice(0, 2)
  const perkSlots = [
    { rank: 1, label: '#1 Backer', perk: 'Submit up to 3 name suggestions — we approve, you pick. Or hide an easter egg.', icon: '👑' },
    { rank: 2, label: '#2 Backer', perk: 'Gets whichever perk #1 didn\'t choose', icon: '🥈' },
  ]

  // Hosting contributors — only relevant for built apps, but query always runs (returns empty for non-built)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: contribRows } = await supabase
    .from('hosting_contributions')
    .select('id, user_id, amount, created_at')
    .eq('app_idea_id', idea.id)
    .eq('status', 'captured')
    .gte('created_at', thirtyDaysAgo)
    .order('amount', { ascending: false })
    .limit(10)

  const contribUserIds = [...new Set((contribRows ?? []).filter((c) => c.user_id).map((c) => c.user_id!))]
  const contribNameMap: Record<string, string> = {}
  if (contribUserIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', contribUserIds)
    for (const u of userRows ?? []) {
      contribNameMap[u.id] = (u.full_name as string | null)?.split(' ')[0] ?? (u.email as string).split('@')[0]
    }
  }
  const contributors = (contribRows ?? []).map((c) => ({
    ...c,
    displayName: c.user_id ? (contribNameMap[c.user_id] ?? 'Anonymous Backer') : 'Anonymous Backer',
  }))

  const displayTitle = idea.official_name ?? idea.title
  const pct = idea.build_price ? progressPercent(idea.amount_raised, idea.build_price) : 0
  const hours = hoursUntil(idea.funding_deadline)
  const features = (idea.features ?? []) as FeatureItem[]
  const PLEDGE_OPEN = ['submitted', 'under_review', 'awaiting_price', 'priced', 'live', 'funded', 'building', 'in_review', 'built']
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
      <div className="flex flex-col md:flex-row gap-4 md:items-start">

        {/* ── Main / left column ── */}
        <div className="space-y-4 min-w-0 w-full md:w-[65%] md:flex-none">

          {/* Header */}
          <div className="win95-window">
            <div className="win95-title-bar">
              <span className="font-vt323 text-xl truncate flex-1">{displayTitle}</span>
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
                  {displayTitle}
                </h1>
                {idea.official_name ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className="text-xs px-1"
                      style={{
                        fontFamily: 'Share Tech Mono, monospace',
                        color: '#004400',
                        background: '#c8ffc8',
                        border: '1px solid #008000',
                      }}
                    >
                      ✓ Named by the community
                    </span>
                    <span className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
                      Working title: {idea.title}
                    </span>
                  </div>
                ) : isPreLive ? (
                  <div className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
                    working title
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
                    <div className="win95-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                    <span>
                      {formatDollars(idea.amount_raised)} raised of {formatDollars(idea.build_price)} minimum
                    </span>
                    {pct >= 100 ? (
                      <span style={{ color: '#006600', fontWeight: 'bold' }}>Funded ✓ — extra pledges keep this app alive</span>
                    ) : (
                      <span>{pct}% funded</span>
                    )}
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

          {/* Backer Perks panel — show while still fundable or in progress */}
          {!isBuilt && (
            <div className="win95-window">
              <div className="win95-title-bar" style={{ background: '#4b0082' }}>
                <span className="font-vt323 text-lg">🏆 Backer Perks</span>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  The top 2 backers by total pledge amount each get a permanent perk built into the app.
                </p>
                {perkSlots.map((slot, i) => {
                  const holder = topBackers[i]
                  const isYou = holder && currentUserId && holder.userId === currentUserId
                  const isOpen = !holder
                  return (
                    <div
                      key={slot.rank}
                      className="win95-raised p-2"
                      style={{
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: 12,
                        borderColor: isYou ? '#4b0082 #c0a0ff #c0a0ff #4b0082' : undefined,
                        background: isYou ? '#f8f0ff' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                        <span style={{ fontWeight: 'bold' }}>{slot.icon} {slot.label}</span>
                        {holder ? (
                          <span style={{ color: isYou ? '#4b0082' : '#000080' }}>
                            {isYou ? '★ You' : holder.displayName} · {formatDollars(holder.total)}
                          </span>
                        ) : (
                          <span style={{ color: '#808080' }}>— open —</span>
                        )}
                      </div>
                      <div style={{ color: '#404040' }}>{slot.perk}</div>
                      {isYou && (
                        <div style={{ marginTop: 4, color: '#4b0082', fontWeight: 'bold' }}>
                          ✓ This perk is yours — we&apos;ll reach out after the build is funded.
                        </div>
                      )}
                      {isOpen && (
                        <div style={{ marginTop: 4, color: '#006600' }}>
                          Back this app to claim this spot.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Hosting panel — full-width layout for built apps */}
          {isBuilt && (
            <div className="win95-window">
              <div className="win95-title-bar">
                <span className="font-vt323 text-lg">Keep this app alive</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  {hGoal > 0
                    ? `Help keep this app alive — ${formatDollars(hGoal)}/month covers hosting and maintenance. Contribute any amount.`
                    : 'Help keep this app alive by contributing to hosting and maintenance costs.'}
                </p>

                {hGoal > 0 ? (
                  <div className="space-y-2">
                    <div className="win95-progress-track">
                      <div className="win95-progress-fill" style={{ width: `${hPct}%`, background: hColor }} />
                    </div>
                    <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                      <span>{formatDollars(hCollected)} of {formatDollars(hGoal)}/month raised</span>
                      <span style={{ fontWeight: 'bold', color: hColor }}>{hPct}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="win95-sunken p-2 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                    Hosting goal not yet set.
                  </div>
                )}

                {/* Keeping it alive this month */}
                <div className="win95-window">
                  <div className="win95-title-bar">
                    <span className="font-vt323 text-base">🏅 Keeping it alive this month</span>
                  </div>
                  <div className="p-2">
                    {contributors.length === 0 ? (
                      <p className="p-1 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
                        Be the first to help keep this app running this month!
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {contributors.map((c) => {
                          const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
                          const timeLabel = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
                          return (
                            <div
                              key={c.id}
                              className="win95-raised p-2 flex justify-between items-center gap-3 text-xs"
                              style={{ fontFamily: 'Share Tech Mono, monospace' }}
                            >
                              <span className="truncate flex-1"><strong>{c.displayName}</strong></span>
                              <span style={{ color: '#808080', flexShrink: 0 }}>{timeLabel}</span>
                              <span style={{ color: '#000080', fontWeight: 'bold', flexShrink: 0 }}>{formatDollars(c.amount)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
                  Your contribution keeps this app alive for the community.
                </p>

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

        {/* ── Right column (35%) — sticky ── */}
        {isPledgeOpen && (
          <div className="w-full md:w-[35%] md:flex-none min-w-0 md:sticky md:top-4 md:self-start">
            <PledgeBox appIdeaId={idea.id} slug={slug} fundingDeadline={idea.funding_deadline} status={idea.status} />
          </div>
        )}

      </div>
    </div>
  )
}
