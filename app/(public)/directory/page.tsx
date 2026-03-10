export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

export default async function DirectoryPage() {
  const supabase = await createClient()

  const { data: apps } = await supabase
    .from('live_apps')
    .select('*, app_ideas(title, slug, goal_description, hosting_monthly_goal, hosting_collected, hosting_status, demo_url, official_name)')
    .eq('is_online', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Shipd Apps</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-5xl" style={{ color: '#000080' }}>
            SHIPD APPS
          </h1>
          <p className="text-sm mt-1">
            Community-funded apps that have shipd — free to use, kept alive by backers.
          </p>
        </div>
      </div>

      {!apps?.length ? (
        <div className="win95-window max-w-md mx-auto">
          <div className="win95-title-bar">
            <span className="font-vt323">No Apps Yet</span>
          </div>
          <div className="p-6 text-center">
            <p className="font-vt323 text-3xl mb-2" style={{ color: '#000080' }}>
              COMING SOON
            </p>
            <p className="text-sm">No apps have shipd yet. Fund one to make it happen!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map((app) => {
            const idea = (app.app_ideas as unknown) as
              | { title: string; slug: string; goal_description: string; hosting_monthly_goal: number; hosting_collected: number; hosting_status: string; demo_url: string | null; official_name: string | null }
              | null
            const displayName = idea?.official_name ?? app.official_name
            const hasOfficialName = !!idea?.official_name
            const appUrl = idea?.demo_url ?? `https://${app.subdomain}.shipdit.co`
            return (
              <div key={app.id} className="win95-window">
                <div className="win95-title-bar">
                  <span className="font-vt323 text-lg">{displayName}</span>
                  {app.is_featured && (
                    <span className="text-xs" style={{ color: '#ffff00' }}>
                      ★ FEATURED
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  {hasOfficialName && (
                    <div className="flex flex-wrap items-center gap-2">
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
                        working title: {idea?.title}
                      </span>
                    </div>
                  )}
                  {idea && <p className="text-xs">{idea.goal_description}</p>}

                  {/* Hosting meter */}
                  {idea && idea.hosting_monthly_goal > 0 && (() => {
                    const hPct = Math.min(100, Math.round((idea.hosting_collected / idea.hosting_monthly_goal) * 100))
                    const hColor = hPct >= 50 ? '#006600' : hPct >= 25 ? '#886600' : '#cc0000'
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                          <span style={{ color: '#404040' }}>Hosting</span>
                          <span style={{ color: hColor, fontWeight: 'bold' }}>{hPct}%</span>
                        </div>
                        <div className="win95-progress-track" style={{ height: 6 }}>
                          <div className="win95-progress-fill" style={{ width: `${hPct}%`, background: hColor }} />
                        </div>
                      </div>
                    )
                  })()}

                  <div className="win95-raised p-2 text-xs">
                    <p>
                      URL:{' '}
                      <span style={{ color: '#000080' }}>
                        {appUrl.replace(/^https?:\/\//, '')}
                      </span>
                    </p>
                    <p>Users: {app.user_count}</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={appUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="win95-btn text-xs flex-1 text-center"
                    >
                      Open App →
                    </a>
                    {idea?.slug && (
                      <a href={`/hosting/${idea.slug}`} className="win95-btn text-xs text-center">
                        Hosting
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
