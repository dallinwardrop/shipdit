export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

export default async function DirectoryPage() {
  const supabase = await createClient()

  const { data: apps } = await supabase
    .from('live_apps')
    .select('*, app_ideas(title, slug, goal_description)')
    .eq('is_online', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Live Apps Directory</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-5xl" style={{ color: '#000080' }}>
            LIVE APPS
          </h1>
          <p className="text-sm mt-1">
            Community-funded apps that have been built and are free for everyone.
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
            <p className="text-sm">No apps have shipped yet. Fund one to make it happen!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map((app) => {
            const idea = (app.app_ideas as unknown) as
              | { title: string; slug: string; goal_description: string }
              | null
            return (
              <div key={app.id} className="win95-window">
                <div className="win95-title-bar">
                  <span className="font-vt323 text-lg">{app.official_name}</span>
                  {app.is_featured && (
                    <span className="text-xs" style={{ color: '#ffff00' }}>
                      ★ FEATURED
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  {idea && <p className="text-xs">{idea.goal_description}</p>}
                  <div className="win95-raised p-2 text-xs">
                    <p>
                      URL:{' '}
                      <span style={{ color: '#000080' }}>
                        {app.subdomain}.shipdit.co
                      </span>
                    </p>
                    <p>Users: {app.user_count}</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://${app.subdomain}.shipdit.co`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="win95-btn text-xs flex-1 text-center"
                    >
                      Open App →
                    </a>
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
