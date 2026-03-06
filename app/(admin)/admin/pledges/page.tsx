import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
import { formatDollars } from '@/lib/utils'

export default async function PledgesPage() {
  const admin = createAdminClient()

  const { data: pledges } = await admin
    .from('pledges')
    .select('id, amount, type, status, is_submitter_pledge, created_at, captured_at, refunded_at, app_ideas(title, slug), users(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  const STATUS_COLORS: Record<string, string> = {
    held: '#006600',
    captured: '#000080',
    pending: '#404040',
    refunded: '#800000',
    failed: 'darkred',
  }

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

      <div className="win95-window">
        <div className="p-2 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr className="win95-raised">
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Idea</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-center">Type</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {pledges?.map((pledge, idx) => {
                const user = (pledge.users as unknown) as { email: string; full_name: string | null } | null
                const idea = (pledge.app_ideas as unknown) as { title: string; slug: string } | null
                return (
                  <tr key={pledge.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f0f0f0' }}>
                    <td className="p-2">{user?.full_name ?? user?.email ?? '—'}</td>
                    <td className="p-2">
                      {idea ? (
                        <a href={`/fund/${idea.slug}`} style={{ color: '#000080' }}>
                          {idea.title}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-2 text-right font-bold">{formatDollars(pledge.amount)}</td>
                    <td className="p-2 text-center">{pledge.type}</td>
                    <td className="p-2 text-center">
                      <span
                        style={{
                          color: STATUS_COLORS[pledge.status] ?? 'black',
                          fontWeight: 'bold',
                          fontSize: 10,
                        }}
                      >
                        {pledge.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2">
                      {new Date(pledge.created_at).toLocaleDateString('en-US')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
