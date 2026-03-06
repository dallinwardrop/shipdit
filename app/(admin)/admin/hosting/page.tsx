import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
import { formatDollars, daysUntil } from '@/lib/utils'

export default async function HostingPage() {
  const admin = createAdminClient()

  const { data: apps } = await admin
    .from('live_apps')
    .select('id, official_name, subdomain, is_online, hosting_expires_at, hosting_fund_balance, user_count, app_ideas(title, slug)')
    .order('hosting_expires_at', { ascending: true })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Hosting Management</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>
            HOSTING STATUS
          </h1>
        </div>
      </div>

      <div className="win95-window">
        <div className="p-2 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr className="win95-raised">
                <th className="p-2 text-left">App</th>
                <th className="p-2 text-left">Subdomain</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-center">Days Left</th>
                <th className="p-2 text-right">Fund Balance</th>
                <th className="p-2 text-right">Users</th>
              </tr>
            </thead>
            <tbody>
              {apps?.map((app, idx) => {
                const days = daysUntil(app.hosting_expires_at)
                const isExpiring = days !== null && days <= 14
                const isExpired = days !== null && days <= 0
                return (
                  <tr key={app.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f0f0f0' }}>
                    <td className="p-2">{app.official_name}</td>
                    <td className="p-2" style={{ color: '#000080' }}>
                      {app.subdomain}.shipdit.co
                    </td>
                    <td className="p-2 text-center">
                      <span
                        style={{
                          color: app.is_online ? 'green' : 'darkred',
                          fontWeight: 'bold',
                          fontSize: 10,
                        }}
                      >
                        {app.is_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td
                      className="p-2 text-center"
                      style={{
                        color: isExpired ? 'darkred' : isExpiring ? 'darkorange' : 'inherit',
                        fontWeight: isExpiring ? 'bold' : 'normal',
                      }}
                    >
                      {days !== null ? (isExpired ? 'EXPIRED' : `${days}d`) : '—'}
                    </td>
                    <td className="p-2 text-right">{formatDollars(app.hosting_fund_balance)}</td>
                    <td className="p-2 text-right">{app.user_count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!apps?.length && (
            <p className="text-sm p-4 text-center">No live apps yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
