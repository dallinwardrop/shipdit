export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { FeedFilter, type IdeaWithTopDonor } from './FeedFilter'

async function getAllIdeas(): Promise<IdeaWithTopDonor[]> {
  const supabase = createAdminClient()

  const { data: ideas, error } = await supabase
    .from('app_ideas')
    .select('*')
    .in('status', ['submitted', 'under_review', 'awaiting_price', 'priced', 'live', 'funded', 'building', 'in_review', 'built', 'expired'])

  if (error || !ideas) return []

  // Bulk-fetch pledge activity from the last 7 days for momentum scoring
  const now = new Date()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentPledges } = await supabase
    .from('pledges')
    .select('app_idea_id, created_at')
    .in('app_idea_id', ideas.map((i) => i.id))
    .eq('type', 'pledge')
    .in('status', ['held', 'captured'])
    .gte('created_at', since7d)

  // Group counts by idea
  const pledgeMap: Record<string, { last24h: number; last7d: number }> = {}
  for (const p of recentPledges ?? []) {
    if (!pledgeMap[p.app_idea_id]) pledgeMap[p.app_idea_id] = { last24h: 0, last7d: 0 }
    pledgeMap[p.app_idea_id].last7d++
    if (p.created_at >= since24h) pledgeMap[p.app_idea_id].last24h++
  }

  // Momentum score: ((24h * 3) + 7d) / (hoursOld + 2)^1.2
  function momentumScore(idea: { id: string; created_at: string }): number {
    const c = pledgeMap[idea.id] ?? { last24h: 0, last7d: 0 }
    const hoursOld = (now.getTime() - new Date(idea.created_at).getTime()) / 3_600_000
    return (c.last24h * 3 + c.last7d) / Math.pow(hoursOld + 2, 1.2)
  }

  const enriched = await Promise.all(
    ideas.map(async (idea) => {
      const { data: topPledge } = await supabase
        .from('pledges')
        .select('amount, users(full_name, username)')
        .eq('app_idea_id', idea.id)
        .eq('type', 'pledge')
        .in('status', ['held', 'captured'])
        .order('amount', { ascending: false })
        .limit(1)
        .single()

      const donor = (topPledge?.users as unknown) as { full_name: string | null; username: string | null } | null
      const top_donor_name = donor?.full_name ?? donor?.username ?? null

      return { ...idea, top_donor_name }
    })
  )

  // Sort by momentum desc, fall back to amount_raised for ties
  enriched.sort((a, b) => {
    const diff = momentumScore(b) - momentumScore(a)
    if (diff !== 0) return diff
    return (b.amount_raised ?? 0) - (a.amount_raised ?? 0)
  })

  return enriched
}

export default async function FundingFeedPage() {
  const ideas = await getAllIdeas()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Shipdit.exe — Community Funding Queue</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="font-vt323 text-5xl" style={{ color: '#000080', lineHeight: 1 }}>
              FUND THE NEXT APP
            </h1>
            <p className="text-sm mt-1">
              Pledge to fund ideas you want built. Reach the goal → I build it → everyone gets it free.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/submit" className="win95-btn-primary win95-btn text-sm whitespace-nowrap">
              + Submit Idea
            </Link>
            <Link href="/directory" className="win95-btn text-sm whitespace-nowrap">
              Live Apps →
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">How It Works</span>
        </div>
        <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
          {[
            { step: '1', label: 'Submit an idea + pledge', icon: '💡' },
            { step: '2', label: 'Community funds the goal', icon: '💰' },
            { step: '3', label: 'I build the app', icon: '🔨' },
            { step: '4', label: 'Use it free — kept alive by backers', icon: '🚀' },
          ].map(({ step, label, icon }) => (
            <div key={step} className="win95-raised p-2 space-y-1">
              <div className="font-vt323 text-3xl">{icon}</div>
              <div className="font-vt323 text-lg" style={{ color: '#000080' }}>Step {step}</div>
              <div>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar + cards */}
      <FeedFilter ideas={ideas} />
    </div>
  )
}
