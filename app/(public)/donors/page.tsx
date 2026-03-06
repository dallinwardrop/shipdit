export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatDollars } from '@/lib/utils'

const TIER_LABELS: Record<string, string> = {
  legend: '👑 LEGEND',
  patron: '⭐ PATRON',
  backer: '🔵 BACKER',
  supporter: '🟢 SUPPORTER',
  watcher: '⚪ WATCHER',
}

export default async function DonorsPage() {
  const supabase = await createClient()

  const { data: donors } = await supabase
    .from('users')
    .select('id, full_name, username, tier, total_pledged, avatar_url')
    .gt('total_pledged', 0)
    .order('total_pledged', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Donor Leaderboard</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-5xl" style={{ color: '#000080' }}>
            HALL OF FAME
          </h1>
          <p className="text-sm mt-1">
            The people who make apps happen. Pledge totals are captured pledges only.
          </p>
        </div>
      </div>

      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">Top Backers</span>
        </div>
        <div className="p-2">
          {!donors?.length ? (
            <p className="text-sm p-4 text-center">No donors yet. Be the first!</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="win95-raised" style={{ textAlign: 'left' }}>
                  <th className="p-2 text-xs">#</th>
                  <th className="p-2 text-xs">Name</th>
                  <th className="p-2 text-xs">Tier</th>
                  <th className="p-2 text-xs" style={{ textAlign: 'right' }}>
                    Total Pledged
                  </th>
                </tr>
              </thead>
              <tbody>
                {donors.map((donor, idx) => (
                  <tr
                    key={donor.id}
                    className={idx % 2 === 0 ? 'win95-sunken' : ''}
                    style={{ borderBottom: '1px solid #c0c0c0' }}
                  >
                    <td className="p-2 text-sm">{idx + 1}</td>
                    <td className="p-2 text-sm">
                      {donor.full_name ?? donor.username ?? 'Anonymous'}
                    </td>
                    <td className="p-2 text-xs">
                      {TIER_LABELS[donor.tier] ?? donor.tier}
                    </td>
                    <td className="p-2 text-sm" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {formatDollars(donor.total_pledged)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tier legend */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">Tier Thresholds</span>
        </div>
        <div className="p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-center">
          {[
            { tier: 'Watcher', min: '$0', icon: '⚪' },
            { tier: 'Supporter', min: '$100', icon: '🟢' },
            { tier: 'Backer', min: '$500', icon: '🔵' },
            { tier: 'Patron', min: '$5,000', icon: '⭐' },
            { tier: 'Legend', min: '$15,000', icon: '👑' },
          ].map(({ tier, min, icon }) => (
            <div key={tier} className="win95-raised p-2">
              <div className="text-xl">{icon}</div>
              <div className="font-bold">{tier}</div>
              <div style={{ color: '#404040' }}>{min}+</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
