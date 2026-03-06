import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
import { formatDollars } from '@/lib/utils'

export default async function PipelinePage() {
  const admin = createAdminClient()

  const { data: ideas } = await admin
    .from('app_ideas')
    .select('id, title, slug, status, submitter_pledge_amount, amount_raised, build_price, created_at, submitter_id, users(email, full_name)')
    .not('status', 'in', '("built","rejected","expired")')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Idea Pipeline</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>
            PIPELINE
          </h1>
        </div>
      </div>

      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">All Active Ideas</span>
        </div>
        <div className="p-2 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr className="win95-raised">
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Submitter</th>
                <th className="p-2 text-right">Pledge</th>
                <th className="p-2 text-right">Raised</th>
                <th className="p-2 text-right">Goal</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ideas?.map((idea, idx) => {
                const submitter = (idea.users as unknown) as { email: string; full_name: string | null } | null
                return (
                  <tr key={idea.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f0f0f0' }}>
                    <td className="p-2">
                      <a href={`/fund/${idea.slug}`} style={{ color: '#000080' }}>
                        {idea.title}
                      </a>
                    </td>
                    <td className="p-2">
                      <span className="win95-raised px-1" style={{ fontSize: 10 }}>
                        {idea.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2">{submitter?.full_name ?? submitter?.email ?? '—'}</td>
                    <td className="p-2 text-right">
                      {formatDollars(idea.submitter_pledge_amount)}
                    </td>
                    <td className="p-2 text-right">{formatDollars(idea.amount_raised)}</td>
                    <td className="p-2 text-right">
                      {idea.build_price ? formatDollars(idea.build_price) : '—'}
                    </td>
                    <td className="p-2">
                      <a href={`/admin/pipeline?action=advance&id=${idea.id}`} className="win95-btn text-xs">
                        Advance
                      </a>
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
