'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDollars, progressPercent } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type IdeaRow = {
  id: string
  title: string
  slug: string | null
  status: string
  amount_raised: number
  build_price: number | null
  backer_count: number
  created_at: string
  submitter_id: string
  // Detail fields
  goal_description: string | null
  features: Array<{ priority: string; text: string }> | null
  target_user: string | null
  similar_apps: string | null
  platform_preference: string | null
  submitter_pledge_amount: number | null
  admin_notes: string | null
  hosting_monthly_goal: number | null
}

export type PledgeRow = {
  id: string
  amount: number
  type: string
  status: string
  created_at: string
  app_idea_id: string
  user_id: string
}

export type UserRow = {
  id: string
  email: string
  username: string | null
  tier: string
  total_pledged: number
  created_at: string
  is_admin: boolean
}

export type HostingRow = {
  id: string
  title: string
  slug: string | null
  hosting_monthly_goal: number
  hosting_collected: number
  hosting_status: string
}

export type SupporterRow = {
  id: string
  email: string
  amount: number
  created_at: string
  stripe_payment_intent_id: string
}

// ── Pipeline columns ──────────────────────────────────────────────────────────

const PIPELINE_COLS = [
  { status: 'under_review',   label: 'Under Review' },
  { status: 'awaiting_price', label: 'Awaiting Price' },
  { status: 'priced',         label: 'Priced' },
  { status: 'live',           label: 'Live' },
  { status: 'funded',         label: 'Funded' },
  { status: 'building',       label: 'Building' },
  { status: 'in_review',      label: 'In Review' },
  { status: 'built',          label: 'Built' },
]

// ── Shared button styles ──────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  fontFamily: 'Share Tech Mono, monospace',
  fontSize: 11,
  cursor: 'pointer',
  padding: '2px 6px',
  background: '#c0c0c0',
  border: '2px solid',
  borderColor: '#fff #808080 #808080 #fff',
}
const btnNavy: React.CSSProperties = {
  ...btnBase,
  background: '#000080',
  color: '#fff',
  borderColor: '#000040 #8080ff #8080ff #000040',
}
const btnDanger: React.CSSProperties = { ...btnBase, color: 'darkred' }

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function AdminDashboard({
  ideas,
  pledges,
  users,
  shippedIdeas,
  supporters,
}: {
  ideas: IdeaRow[]
  pledges: PledgeRow[]
  users: UserRow[]
  shippedIdeas: HostingRow[]
  supporters: SupporterRow[]
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<'pipeline' | 'ledger' | 'users' | 'hosting' | 'supporters'>('pipeline')

  // Per-idea action state
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({})
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [priceOpen, setPriceOpen] = useState<Record<string, boolean>>({})
  const [buildPrice, setBuildPrice] = useState<Record<string, string>>({})
  const [buildTime, setBuildTime] = useState<Record<string, string>>({})

  // Per-button loading/success/error state keyed by e.g. "${ideaId}::approve"
  const [btnState, setBtnState] = useState<Record<string, 'loading' | 'success' | 'error'>>({})

  // Detail modal
  const [expandedIdea, setExpandedIdea] = useState<IdeaRow | null>(null)
  const [modalNotes, setModalNotes] = useState('')

  // Ledger filter
  const [pledgeFilter, setPledgeFilter] = useState('all')

  // Hosting panel state
  const [hostingGoalEdit, setHostingGoalEdit] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  // Lookup maps
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
  const ideaMap = Object.fromEntries(ideas.map((i) => [i.id, i]))

  // ── Button state helpers ──────────────────────────────────────────────────

  function isCardBusy(ideaId: string) {
    return Object.keys(btnState).some(
      (k) => k.startsWith(`${ideaId}::`) && btnState[k] === 'loading'
    )
  }

  function bsOf(key: string) { return btnState[key] ?? 'idle' }

  function styledBtn(base: React.CSSProperties, key: string): React.CSSProperties {
    const s = bsOf(key)
    if (s === 'loading') return { ...base, borderColor: '#808080 #fff #fff #808080', cursor: 'default', opacity: 0.85 }
    if (s === 'success') return { ...base, background: '#004000', color: '#c0ffc0', borderColor: '#002000 #80ff80 #80ff80 #002000' }
    if (s === 'error')   return { ...base, background: '#600000', color: '#ffc0c0', borderColor: '#400000 #ff8080 #ff8080 #400000' }
    return base
  }

  function btnTxt(label: string, key: string): string {
    const s = bsOf(key)
    if (s === 'loading') return '⌛ Working...'
    if (s === 'success') return '✓ Done!'
    if (s === 'error')   return '⚠ Failed'
    return label
  }

  function buildPrompt(idea: IdeaRow): string {
    const featureLines = (idea.features ?? [])
      .map((f) => `- [${f.priority}] ${f.text}`)
      .join('\n')
    return `Build a web app with the following spec:

**App Name:** ${idea.title}
**Target User:** ${idea.target_user ?? '—'}
**Platform:** ${idea.platform_preference ?? 'web'}
**Description:** ${idea.goal_description ?? '—'}
**Features:**
${featureLines || '- (no features listed)'}
**Similar Apps:** ${idea.similar_apps ?? 'None listed'}

Technical requirements:
- Deploy to Firebase Hosting so it can be hosted at ${idea.slug ?? '[slug]'}.shipdit.co
- Mobile responsive
- Clean, modern UI
- Free to use for all users
- No login required unless essential to the core feature

Start with a fully working MVP that covers the core use case. Do not add unnecessary complexity. Ship fast.`
  }

  function copyPrompt(idea: IdeaRow) {
    navigator.clipboard.writeText(buildPrompt(idea)).then(() => {
      setCopied((s) => ({ ...s, [idea.id]: true }))
      setTimeout(() => setCopied((s) => { const n = { ...s }; delete n[idea.id]; return n }), 1800)
    })
  }

  async function act(url: string, body: Record<string, unknown>, key: string) {
    setBtnState((s) => ({ ...s, [key]: 'loading' }))
    const fail = () => {
      setBtnState((s) => ({ ...s, [key]: 'error' }))
      setTimeout(() => setBtnState((s) => { const n = { ...s }; delete n[key]; return n }), 2500)
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { fail(); return false }
      setBtnState((s) => ({ ...s, [key]: 'success' }))
      setTimeout(() => {
        setBtnState((s) => { const n = { ...s }; delete n[key]; return n })
        router.refresh()
      }, 1000)
      return true
    } catch {
      fail()
      return false
    }
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const sidebar = (
    <div className="win95-window w-full md:w-[168px] md:flex-none md:sticky md:top-[60px] md:self-start">
      <div className="win95-title-bar">
        <span className="font-vt323 text-base">Command Center</span>
      </div>
      <div className="p-1 space-y-1">
        {(
          [
            ['pipeline',   '📋 Pipeline'],
            ['ledger',     '💳 Pledge Ledger'],
            ['users',      '👤 Users'],
            ['hosting',    '🖥 Hosting'],
            ['supporters', '⭐ Supporters'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPanel(key)}
            style={{ ...(panel === key ? btnNavy : btnBase), width: '100%', textAlign: 'left', padding: '4px 8px' }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-1" style={{ borderTop: '1px solid #808080' }}>
        <a
          href="/admin/hooks"
          style={{ ...btnBase, display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', textDecoration: 'none', color: 'inherit' }}
        >
          🎵 TikTok Hooks
        </a>
      </div>
      <div className="p-2 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', borderTop: '1px solid #808080', color: '#404040' }}>
        {ideas.filter(i => i.status === 'under_review').length} awaiting review
      </div>
    </div>
  )

  // ── Pipeline panel ────────────────────────────────────────────────────────

  const pipelinePanel = (
    <div className="win95-window" style={{ flex: 1, minWidth: 0 }}>
      <div className="win95-title-bar">
        <span className="font-vt323 text-lg">Pipeline</span>
        <span className="text-xs opacity-70 ml-2">
          {ideas.length} ideas
        </span>
      </div>
      <div style={{ overflowX: 'auto', padding: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 'max-content' }}>
          {PIPELINE_COLS.map(({ status, label }) => {
            const colIdeas = ideas.filter((i) => i.status === status)
            return (
              <div key={status} className="win95-window" style={{ width: 268, flexShrink: 0 }}>
                <div className="win95-title-bar" style={{ background: '#000060' }}>
                  <span className="font-vt323 text-base">{label}</span>
                  <span className="text-xs opacity-70 ml-1">({colIdeas.length})</span>
                </div>
                <div className="p-2 space-y-2">
                  {colIdeas.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ opacity: 0.4, fontFamily: 'Share Tech Mono, monospace' }}>
                      — empty —
                    </p>
                  )}
                  {colIdeas.map((idea) => {
                    const submitterEmail = userMap[idea.submitter_id]?.email ?? '—'
                    const isLoading = isCardBusy(idea.id)
                    const pct = idea.build_price ? progressPercent(idea.amount_raised, idea.build_price) : 0

                    return (
                      <div
                        key={idea.id}
                        className="win95-raised p-2 space-y-2"
                        style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}
                      >
                        {/* Idea meta — click to expand */}
                        <div
                          onClick={() => { setExpandedIdea(idea); setModalNotes(idea.admin_notes ?? '') }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="font-vt323" style={{ fontSize: 15, color: '#000080' }}>
                            {idea.title}
                          </div>
                          <div style={{ opacity: 0.6 }}>{idea.slug ?? '—'}</div>
                          <div>{submitterEmail}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span>{formatDollars(idea.amount_raised)}</span>
                            <span>{idea.backer_count} backers</span>
                          </div>
                          <div style={{ opacity: 0.5 }}>
                            {new Date(idea.created_at).toLocaleDateString()}
                          </div>
                          {idea.admin_notes && (
                            <div style={{ marginTop: 2, opacity: 0.7, fontStyle: 'italic' }}>
                              📝 {idea.admin_notes.slice(0, 40)}{idea.admin_notes.length > 40 ? '…' : ''}
                            </div>
                          )}
                        </div>

                        {/* Progress bar (priced and beyond) */}
                        {['priced', 'live', 'funded', 'building', 'in_review', 'built'].includes(status) && idea.build_price && (
                          <div className="space-y-1">
                            <div className="win95-progress-track" style={{ height: 12 }}>
                              <div className="win95-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{formatDollars(idea.amount_raised)} / {formatDollars(idea.build_price)}</span>
                              <span>{pct}%</span>
                            </div>
                          </div>
                        )}

                        {/* BUILT: Hosting goal inline edit */}
                        {status === 'built' && (
                          <div className="space-y-1">
                            <div style={{ opacity: 0.6 }}>Hosting goal ($/mo):</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input
                                type="number"
                                className="win95-input"
                                style={{ fontSize: 11, flex: 1 }}
                                placeholder="e.g. 50"
                                value={hostingGoalEdit[idea.id] ?? String(Math.round((idea.hosting_monthly_goal ?? 0) / 100))}
                                onChange={(e) => setHostingGoalEdit((p) => ({ ...p, [idea.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => {
                                  const dollars = parseFloat(hostingGoalEdit[idea.id] ?? '0')
                                  act('/api/admin/hosting', { idea_id: idea.id, hosting_monthly_goal: Math.round(dollars * 100) }, `${idea.id}::h-goal`)
                                }}
                                disabled={isLoading}
                                style={styledBtn({ ...btnNavy, padding: '1px 6px' }, `${idea.id}::h-goal`)}
                              >
                                {btnTxt('Save', `${idea.id}::h-goal`)}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* UNDER REVIEW: Approve / Reject */}
                        {status === 'under_review' && (
                          <div className="space-y-1">
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => act('/api/admin/approve', { idea_id: idea.id }, `${idea.id}::approve`)}
                                disabled={isLoading}
                                style={styledBtn({ ...btnNavy, flex: 1 }, `${idea.id}::approve`)}
                              >
                                {btnTxt('APPROVE', `${idea.id}::approve`)}
                              </button>
                              <button
                                onClick={() => setRejectOpen((p) => ({ ...p, [idea.id]: !p[idea.id] }))}
                                disabled={isLoading}
                                style={{ ...btnDanger, flex: 1 }}
                              >
                                REJECT
                              </button>
                            </div>
                            {rejectOpen[idea.id] && (
                              <div className="space-y-1">
                                <textarea
                                  className="win95-textarea"
                                  rows={2}
                                  style={{ fontSize: 11 }}
                                  placeholder="Rejection reason…"
                                  value={rejectReason[idea.id] ?? ''}
                                  onChange={(e) =>
                                    setRejectReason((p) => ({ ...p, [idea.id]: e.target.value }))
                                  }
                                />
                                <button
                                  onClick={async () => {
                                    const ok = await act(
                                      '/api/admin/reject',
                                      { idea_id: idea.id, rejection_reason: rejectReason[idea.id] ?? '' },
                                      `${idea.id}::reject`
                                    )
                                    if (ok) setRejectOpen((p) => ({ ...p, [idea.id]: false }))
                                  }}
                                  disabled={isLoading}
                                  style={styledBtn({ ...btnDanger, width: '100%' }, `${idea.id}::reject`)}
                                >
                                  {btnTxt('Confirm Reject', `${idea.id}::reject`)}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* AWAITING PRICE: Set Price */}
                        {status === 'awaiting_price' && (
                          <div className="space-y-1">
                            <button
                              onClick={() => setPriceOpen((p) => ({ ...p, [idea.id]: !p[idea.id] }))}
                              disabled={isLoading}
                              style={{ ...btnNavy, width: '100%' }}
                            >
                              SET PRICE
                            </button>
                            {priceOpen[idea.id] && (
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  className="win95-input"
                                  style={{ fontSize: 11 }}
                                  placeholder="Build price in $ (e.g. 2000)"
                                  value={buildPrice[idea.id] ?? ''}
                                  onChange={(e) =>
                                    setBuildPrice((p) => ({ ...p, [idea.id]: e.target.value }))
                                  }
                                />
                                <input
                                  type="text"
                                  className="win95-input"
                                  style={{ fontSize: 11 }}
                                  placeholder="Build time (e.g. 4 weeks)"
                                  value={buildTime[idea.id] ?? ''}
                                  onChange={(e) =>
                                    setBuildTime((p) => ({ ...p, [idea.id]: e.target.value }))
                                  }
                                />
                                <button
                                  onClick={async () => {
                                    const dollars = parseFloat(buildPrice[idea.id] ?? '0')
                                    const ok = await act(
                                      '/api/admin/price',
                                      {
                                        idea_id: idea.id,
                                        build_price: Math.round(dollars * 100),
                                        build_time_estimate: buildTime[idea.id] ?? '',
                                      },
                                      `${idea.id}::price`
                                    )
                                    if (ok) setPriceOpen((p) => ({ ...p, [idea.id]: false }))
                                  }}
                                  disabled={isLoading}
                                  style={styledBtn({ ...btnNavy, width: '100%' }, `${idea.id}::price`)}
                                >
                                  {btnTxt('Save Price', `${idea.id}::price`)}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* LIVE + goal hit: Capture All */}
                        {status === 'live' && idea.build_price != null && idea.amount_raised >= idea.build_price && (
                          <button
                            onClick={() => {
                              if (confirm(`Capture all pledges for "${idea.title}"? This will charge all backers.`)) {
                                act('/api/capture', { idea_id: idea.id }, `${idea.id}::capture`)
                              }
                            }}
                            disabled={isLoading}
                            style={styledBtn({ ...btnNavy, width: '100%', padding: '4px', background: '#006000', borderColor: '#004000 #80ff80 #80ff80 #004000' }, `${idea.id}::capture`)}
                          >
                            {btnTxt('💰 CAPTURE ALL PLEDGES', `${idea.id}::capture`)}
                          </button>
                        )}

                        {/* LIVE + goal NOT hit: Force Fund */}
                        {status === 'live' && (idea.build_price == null || idea.amount_raised < idea.build_price) && (
                          <button
                            onClick={() => {
                              const raised = formatDollars(idea.amount_raised)
                              const goal = idea.build_price ? formatDollars(idea.build_price) : 'no goal set'
                              if (confirm(`FORCE FUND "${idea.title}"?\n\nRaised: ${raised} of ${goal}\n\nThis will capture all held pledges and mark the idea as funded regardless of whether the goal was hit. Backers will be charged. This cannot be undone.`)) {
                                act('/api/capture', { idea_id: idea.id }, `${idea.id}::force-fund`)
                              }
                            }}
                            disabled={isLoading}
                            style={styledBtn({ ...btnBase, width: '100%', padding: '4px', color: '#804000', borderColor: '#fff #808080 #808080 #fff' }, `${idea.id}::force-fund`)}
                          >
                            {btnTxt('⚡ FORCE FUND', `${idea.id}::force-fund`)}
                          </button>
                        )}

                        {/* FUNDED: Start Building */}
                        {status === 'funded' && (
                          <button
                            onClick={() => act('/api/approve', { app_idea_id: idea.id, action: 'advance' }, `${idea.id}::start-building`)}
                            disabled={isLoading}
                            style={styledBtn({ ...btnNavy, width: '100%', padding: '4px' }, `${idea.id}::start-building`)}
                          >
                            {btnTxt('🔨 START BUILDING', `${idea.id}::start-building`)}
                          </button>
                        )}

                        {/* BUILDING: Mark In Review */}
                        {status === 'building' && (
                          <button
                            onClick={() => act('/api/approve', { app_idea_id: idea.id, action: 'advance' }, `${idea.id}::in-review`)}
                            disabled={isLoading}
                            style={styledBtn({ ...btnNavy, width: '100%', padding: '4px' }, `${idea.id}::in-review`)}
                          >
                            {btnTxt('📋 MARK IN REVIEW', `${idea.id}::in-review`)}
                          </button>
                        )}

                        {/* IN REVIEW: Mark Built */}
                        {status === 'in_review' && (
                          <button
                            onClick={() => act('/api/approve', { app_idea_id: idea.id, action: 'advance' }, `${idea.id}::mark-built`)}
                            disabled={isLoading}
                            style={styledBtn({ ...btnNavy, width: '100%', padding: '4px', background: '#300060', borderColor: '#200040 #8040ff #8040ff #200040' }, `${idea.id}::mark-built`)}
                          >
                            {btnTxt('🚀 MARK BUILT', `${idea.id}::mark-built`)}
                          </button>
                        )}

                        {/* PRICED: Go Live */}
                        {status === 'priced' && (
                          <button
                            onClick={() => act('/api/admin/golive', { idea_id: idea.id }, `${idea.id}::golive`)}
                            disabled={isLoading}
                            style={styledBtn({ ...btnNavy, width: '100%', padding: '4px' }, `${idea.id}::golive`)}
                          >
                            {btnTxt('🚀 GO LIVE', `${idea.id}::golive`)}
                          </button>
                        )}

                        {/* Build Prompt — all statuses */}
                        <button
                          onClick={() => copyPrompt(idea)}
                          style={{
                            ...btnBase,
                            width: '100%',
                            marginTop: 4,
                            borderTop: '1px solid #c0c0c0',
                            ...(copied[idea.id] ? { background: '#a0c0a0', borderColor: '#808080 #fff #fff #808080', color: '#004000' } : {}),
                          }}
                        >
                          {copied[idea.id] ? '✓ Copied!' : '📋 Build Prompt'}
                        </button>

                        {/* DELETE — all statuses */}
                        <button
                          onClick={() => {
                            if (confirm('Delete this idea and cancel all pledges? This cannot be undone.')) {
                              act('/api/admin/delete', { idea_id: idea.id }, `${idea.id}::delete`)
                            }
                          }}
                          disabled={isLoading}
                          style={styledBtn({ ...btnDanger, width: '100%', marginTop: 4, borderTop: '1px solid #c08080' }, `${idea.id}::delete`)}
                        >
                          {btnTxt('DELETE', `${idea.id}::delete`)}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── Ledger panel ──────────────────────────────────────────────────────────

  // Show capture section only for ideas that still have held pledges remaining
  const fundedIdeas = ideas.filter((i) => {
    const hasHeldPledges = pledges.some((p) => p.app_idea_id === i.id && p.status === 'held')
    return hasHeldPledges && (
      (i.status === 'live' && i.build_price != null && i.amount_raised >= i.build_price) ||
      i.status === 'funded'
    )
  })
  const filteredPledges =
    pledgeFilter === 'all' ? pledges : pledges.filter((p) => p.status === pledgeFilter)

  const ledgerPanel = (
    <div className="space-y-3" style={{ flex: 1, minWidth: 0 }}>
      {/* Capture section */}
      {fundedIdeas.length > 0 && (
        <div className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-base">Ready to Capture</span>
          </div>
          <div className="p-2 space-y-1">
            {fundedIdeas.map((idea) => (
              <div
                key={idea.id}
                className="win95-raised p-2"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}
              >
                <div>
                  <span className="font-vt323" style={{ fontSize: 16 }}>{idea.title}</span>
                  <span style={{ marginLeft: 8, opacity: 0.6 }}>{formatDollars(idea.amount_raised)} raised</span>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Capture all pledges for "${idea.title}"? This will charge all backers.`)) {
                      act('/api/capture', { idea_id: idea.id }, `${idea.id}::ledger-cap`)
                    }
                  }}
                  disabled={isCardBusy(idea.id)}
                  style={styledBtn({ ...btnNavy, padding: '4px 12px' }, `${idea.id}::ledger-cap`)}
                >
                  {btnTxt('CAPTURE ALL', `${idea.id}::ledger-cap`)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pledge table */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-base">Pledge Ledger</span>
          <span className="text-xs opacity-70 ml-2">({filteredPledges.length})</span>
        </div>
        <div className="p-2 space-y-2">
          {/* Filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['all', 'held', 'captured', 'refunded', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => setPledgeFilter(f)}
                style={{ ...(pledgeFilter === f ? btnNavy : btnBase), padding: '2px 8px' }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#000080', color: '#fff' }}>
                  {['User', 'App', 'Amount', 'Type', 'Status', 'Date'].map((h) => (
                    <th key={h} style={{ padding: '4px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPledges.map((p, i) => {
                  const u = userMap[p.user_id]
                  const idea = ideaMap[p.app_idea_id]
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#e8e8e8' : '#f4f4f4' }}>
                      <td style={{ padding: '3px 6px' }}>{u?.email ?? p.user_id.slice(0, 8) + '…'}</td>
                      <td style={{ padding: '3px 6px' }}>{idea?.slug ?? '—'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{formatDollars(p.amount)}</td>
                      <td style={{ padding: '3px 6px' }}>{p.type}</td>
                      <td style={{ padding: '3px 6px' }}>
                        <span style={{
                          padding: '1px 4px',
                          background: p.status === 'captured' ? '#c0ffc0' : p.status === 'held' ? '#c0c8ff' : p.status === 'refunded' ? '#fff0c0' : '#ffc0c0',
                          border: '1px solid currentColor',
                          fontSize: 10,
                        }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
                {filteredPledges.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, textAlign: 'center', opacity: 0.4 }}>
                      No pledges.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Users panel ───────────────────────────────────────────────────────────

  const usersPanel = (
    <div className="win95-window" style={{ flex: 1, minWidth: 0 }}>
      <div className="win95-title-bar">
        <span className="font-vt323 text-base">Users ({users.length})</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#000080', color: '#fff' }}>
              {['Email', 'Username', 'Tier', 'Total Pledged', 'Joined', 'Admin'].map((h) => (
                <th key={h} style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 0 ? '#e8e8e8' : '#f4f4f4' }}>
                <td style={{ padding: '3px 8px' }}>{u.email}</td>
                <td style={{ padding: '3px 8px' }}>{u.username ?? '—'}</td>
                <td style={{ padding: '3px 8px', textTransform: 'capitalize' }}>{u.tier}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right' }}>{formatDollars(u.total_pledged)}</td>
                <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '3px 8px' }}>
                  {u.is_admin && (
                    <span style={{ background: '#000080', color: '#fff', padding: '1px 4px', fontSize: 9 }}>
                      ADMIN
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── Hosting panel ─────────────────────────────────────────────────────────

  const hostingPanel = (
    <div className="win95-window" style={{ flex: 1, minWidth: 0 }}>
      <div className="win95-title-bar">
        <span className="font-vt323 text-base">Hosting — Shipd Apps ({shippedIdeas.length})</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {shippedIdeas.length === 0 ? (
          <p className="p-4 text-xs text-center" style={{ opacity: 0.4, fontFamily: 'Share Tech Mono, monospace' }}>
            No shipd apps yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#000080', color: '#fff' }}>
                {['App', 'Monthly Goal', 'Collected', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shippedIdeas.map((app, i) => {
                const goal = app.hosting_monthly_goal ?? 0
                const collected = app.hosting_collected ?? 0
                const pct = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0
                const isLoading = isCardBusy(app.id)
                const statusColor = app.hosting_status === 'active' ? '#006000' : app.hosting_status === 'warning' ? '#886600' : '#cc0000'

                return (
                  <tr key={app.id} style={{ background: i % 2 === 0 ? '#e8e8e8' : '#f4f4f4', verticalAlign: 'top' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <div className="font-vt323" style={{ fontSize: 14, color: '#000080' }}>{app.title}</div>
                      {app.slug && <div style={{ opacity: 0.6 }}>{app.slug}</div>}
                    </td>

                    {/* Monthly goal — editable */}
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number"
                          className="win95-input"
                          style={{ width: 80, fontSize: 11 }}
                          placeholder="$ goal"
                          value={hostingGoalEdit[app.id] ?? String(Math.round(goal / 100))}
                          onChange={(e) => setHostingGoalEdit((p) => ({ ...p, [app.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => {
                            const dollars = parseFloat(hostingGoalEdit[app.id] ?? '0')
                            act('/api/admin/hosting', { idea_id: app.id, hosting_monthly_goal: Math.round(dollars * 100) }, `${app.id}::h-goal`)
                          }}
                          disabled={isLoading}
                          style={styledBtn({ ...btnNavy, padding: '1px 6px' }, `${app.id}::h-goal`)}
                        >
                          {btnTxt('Save', `${app.id}::h-goal`)}
                        </button>
                      </div>
                      <div style={{ marginTop: 4, opacity: 0.7 }}>{formatDollars(goal)}/mo</div>
                    </td>

                    {/* Collected + meter */}
                    <td style={{ padding: '6px 8px' }}>
                      <div>{formatDollars(collected)}</div>
                      <div style={{ marginTop: 4, height: 6, background: '#d0d0d0', width: 80 }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: pct >= 50 ? '#006600' : pct >= 25 ? '#886600' : '#cc0000',
                        }} />
                      </div>
                      <div style={{ opacity: 0.7 }}>{pct}%</div>
                    </td>

                    {/* Status toggle */}
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 5px', fontSize: 10,
                        background: app.hosting_status === 'active' ? '#c0ffc0' : app.hosting_status === 'warning' ? '#fff0c0' : '#ffc0c0',
                        border: `1px solid ${statusColor}`, color: statusColor,
                      }}>
                        {(app.hosting_status ?? 'active').toUpperCase()}
                      </span>
                      <div style={{ marginTop: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {['active', 'warning', 'offline'].map((s) => (
                          <button
                            key={s}
                            onClick={() => act('/api/admin/hosting', { idea_id: app.id, hosting_status: s }, `${app.id}::h-${s}`)}
                            disabled={isLoading || app.hosting_status === s}
                            style={styledBtn({ ...btnBase, padding: '1px 4px', fontSize: 10, opacity: app.hosting_status === s ? 0.4 : 1 }, `${app.id}::h-${s}`)}
                          >
                            {btnTxt(s, `${app.id}::h-${s}`)}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '6px 8px' }}>
                      <button
                        onClick={() => {
                          if (confirm(`Send hosting reminder to all backers of "${app.title}"?`)) {
                            act('/api/admin/hosting', { app_idea_id: app.id, send_reminder: true }, `${app.id}::h-remind`)
                          }
                        }}
                        disabled={isLoading}
                        style={styledBtn({ ...btnNavy, padding: '2px 6px', whiteSpace: 'nowrap' }, `${app.id}::h-remind`)}
                      >
                        {btnTxt('Send Reminder', `${app.id}::h-remind`)}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // ── Supporters panel ──────────────────────────────────────────────────────

  const supportersPanel = (
    <div className="win95-window" style={{ flex: 1, minWidth: 0 }}>
      <div className="win95-title-bar">
        <span className="font-vt323 text-base">⭐ Shipdit Supporters ({supporters.length})</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {supporters.length === 0 ? (
          <p className="p-4 text-xs text-center" style={{ opacity: 0.4, fontFamily: 'Share Tech Mono, monospace' }}>
            No supporters yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#5a3000', color: '#ffd080' }}>
                {['Email', 'Amount', 'Date', 'PaymentIntent ID'].map((h) => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supporters.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? '#e8e8e8' : '#f4f4f4' }}>
                  <td style={{ padding: '3px 8px' }}>{s.email}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{formatDollars(s.amount)}</td>
                  <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '3px 8px', opacity: 0.6, fontSize: 10 }}>
                    {s.stripe_payment_intent_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: '#0a0a1a', padding: 12 }}>
      <div className="flex flex-col md:flex-row gap-3 md:items-start">
        {sidebar}
        {panel === 'pipeline'   && pipelinePanel}
        {panel === 'ledger'     && ledgerPanel}
        {panel === 'users'      && usersPanel}
        {panel === 'hosting'    && hostingPanel}
        {panel === 'supporters' && supportersPanel}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {expandedIdea && (
        <div
          onClick={() => setExpandedIdea(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            className="win95-window"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 660, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Title bar */}
            <div className="win95-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span className="font-vt323 text-lg">{expandedIdea.title}</span>
              <button
                onClick={() => setExpandedIdea(null)}
                style={{ ...btnBase, padding: '0 8px', fontFamily: 'monospace', lineHeight: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: 12, flex: 1, fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }} className="space-y-3">
              {/* Meta */}
              <div className="win95-sunken p-2 space-y-1">
                <div><strong>Slug:</strong> {expandedIdea.slug ?? '—'}</div>
                <div><strong>Status:</strong> {expandedIdea.status.toUpperCase()}</div>
                <div><strong>Submitter:</strong> {userMap[expandedIdea.submitter_id]?.email ?? expandedIdea.submitter_id}</div>
                <div><strong>Submitter Pledge:</strong> {expandedIdea.submitter_pledge_amount ? formatDollars(expandedIdea.submitter_pledge_amount) : '—'}</div>
                <div><strong>Created:</strong> {new Date(expandedIdea.created_at).toLocaleString()}</div>
                {expandedIdea.platform_preference && (
                  <div><strong>Platform:</strong> {expandedIdea.platform_preference}</div>
                )}
              </div>

              {/* Goal */}
              {expandedIdea.goal_description && (
                <div>
                  <div className="font-vt323" style={{ fontSize: 16, marginBottom: 4 }}>GOAL DESCRIPTION</div>
                  <div className="win95-sunken p-2" style={{ whiteSpace: 'pre-wrap' }}>{expandedIdea.goal_description}</div>
                </div>
              )}

              {/* Features */}
              {expandedIdea.features && expandedIdea.features.length > 0 && (
                <div>
                  <div className="font-vt323" style={{ fontSize: 16, marginBottom: 4 }}>FEATURES</div>
                  <div className="win95-sunken p-2 space-y-1">
                    {expandedIdea.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{
                          padding: '1px 4px', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0,
                          background: f.priority === 'must_have' ? '#c0ffc0' : f.priority === 'nice_to_have' ? '#ffffc0' : '#ffc0c0',
                          border: '1px solid #808080',
                        }}>
                          {f.priority.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span>{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target user */}
              {expandedIdea.target_user && (
                <div>
                  <div className="font-vt323" style={{ fontSize: 16, marginBottom: 4 }}>TARGET USER</div>
                  <div className="win95-sunken p-2">{expandedIdea.target_user}</div>
                </div>
              )}

              {/* Similar apps */}
              {expandedIdea.similar_apps && (
                <div>
                  <div className="font-vt323" style={{ fontSize: 16, marginBottom: 4 }}>SIMILAR APPS</div>
                  <div className="win95-sunken p-2">{expandedIdea.similar_apps}</div>
                </div>
              )}

              {/* Admin notes */}
              <div>
                <div className="font-vt323" style={{ fontSize: 16, marginBottom: 4 }}>ADMIN NOTES</div>
                <textarea
                  className="win95-textarea"
                  rows={4}
                  style={{ fontSize: 12, width: '100%' }}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Internal notes…"
                />
                <button
                  onClick={() => act('/api/admin/notes', { idea_id: expandedIdea.id, admin_notes: modalNotes }, `${expandedIdea.id}::notes`)}
                  disabled={btnState[`${expandedIdea.id}::notes`] !== undefined}
                  style={styledBtn({ ...btnNavy, marginTop: 4, padding: '3px 12px' }, `${expandedIdea.id}::notes`)}
                >
                  {btnTxt('Save Notes', `${expandedIdea.id}::notes`)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
