import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AppsPage() {
  const admin = createAdminClient()

  const { data: ideas } = await admin
    .from('app_ideas')
    .select('id, title, slug, status, build_status, amount_raised, build_price, funded_at, built_at, demo_url')
    .in('status', ['funded', 'building', 'in_review', 'built'])
    .order('funded_at', { ascending: false })

  const BUILD_STATUS_COLORS: Record<string, string> = {
    not_started: '#808080',
    in_progress: '#000080',
    demo_ready: '#006600',
    shipped: '#000000',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Apps In Progress</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>
            BUILD QUEUE
          </h1>
        </div>
      </div>

      {ideas?.map((idea) => (
        <div key={idea.id} className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">{idea.title}</span>
            <div className="flex gap-2 text-xs">
              <span className="win95-raised px-1">{idea.status.toUpperCase()}</span>
              <span
                style={{
                  color: BUILD_STATUS_COLORS[idea.build_status] ?? 'black',
                  fontWeight: 'bold',
                }}
              >
                {idea.build_status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="p-3 text-xs space-y-1">
            {idea.demo_url && (
              <p>
                Demo:{' '}
                <a href={idea.demo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#000080' }}>
                  {idea.demo_url}
                </a>
              </p>
            )}
            {idea.funded_at && (
              <p>Funded: {new Date(idea.funded_at).toLocaleDateString('en-US')}</p>
            )}
            {idea.built_at && (
              <p>Shipped: {new Date(idea.built_at).toLocaleDateString('en-US')}</p>
            )}
          </div>
        </div>
      ))}

      {!ideas?.length && (
        <div className="win95-window max-w-md mx-auto">
          <div className="win95-title-bar">
            <span className="font-vt323">Empty</span>
          </div>
          <div className="p-4 text-center text-sm">No apps currently in the build queue.</div>
        </div>
      )}
    </div>
  )
}
