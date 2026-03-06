import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
import { formatDollars } from '@/lib/utils'

export default async function UsersPage() {
  const admin = createAdminClient()

  const { data: users } = await admin
    .from('users')
    .select('id, email, full_name, username, tier, total_pledged, is_admin, created_at')
    .order('total_pledged', { ascending: false })
    .limit(200)

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Users</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>
            ALL USERS
          </h1>
        </div>
      </div>

      <div className="win95-window">
        <div className="p-2 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr className="win95-raised">
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-center">Tier</th>
                <th className="p-2 text-right">Total Pledged</th>
                <th className="p-2 text-center">Admin</th>
                <th className="p-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user, idx) => (
                <tr key={user.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f0f0f0' }}>
                  <td className="p-2">{user.email}</td>
                  <td className="p-2">{user.full_name ?? user.username ?? '—'}</td>
                  <td className="p-2 text-center">
                    <span className="win95-raised px-1" style={{ fontSize: 10 }}>
                      {user.tier.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-right font-bold">
                    {formatDollars(user.total_pledged)}
                  </td>
                  <td className="p-2 text-center">{user.is_admin ? '✓' : ''}</td>
                  <td className="p-2">
                    {new Date(user.created_at).toLocaleDateString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
