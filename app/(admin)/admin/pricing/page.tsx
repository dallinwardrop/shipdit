import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
import { formatDollars } from '@/lib/utils'

export default async function PricingPage() {
  const admin = createAdminClient()

  const { data: ideas } = await admin
    .from('app_ideas')
    .select('id, title, slug, status, submitter_pledge_amount, features, target_user, platform_preference, build_price, build_time_estimate, created_at')
    .in('status', ['awaiting_price', 'priced'])
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Pricing Queue</span>
        </div>
        <div className="p-4">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>
            SET BUILD PRICES
          </h1>
          <p className="text-sm mt-1">
            Ideas awaiting a price become the funding goal. POST to /api/approve with action:
            &quot;set_price&quot; to price them.
          </p>
        </div>
      </div>

      {ideas?.map((idea) => (
        <div key={idea.id} className="win95-window">
          <div className="win95-title-bar">
            <span className="font-vt323 text-lg">{idea.title}</span>
            <span className="text-xs win95-raised px-1">{idea.status.toUpperCase()}</span>
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="win95-sunken p-2 space-y-1 text-xs">
              <p>
                Platform: <strong>{idea.platform_preference}</strong>
              </p>
              <p>
                For: <strong>{idea.target_user}</strong>
              </p>
              <p>
                Submitter pledge: <strong>{formatDollars(idea.submitter_pledge_amount)}</strong>
              </p>
              {idea.build_price && (
                <p>
                  Current price: <strong>{formatDollars(idea.build_price)}</strong>
                </p>
              )}
              {idea.build_time_estimate && (
                <p>
                  Time est: <strong>{idea.build_time_estimate}</strong>
                </p>
              )}
            </div>
            <div className="win95-sunken p-2 text-xs">
              <p className="font-bold mb-1">Features:</p>
              {Array.isArray(idea.features) &&
                (idea.features as Array<{ priority: string; text: string }>).map((f, i) => (
                  <div key={i} className="flex gap-1 mb-1">
                    <span className="win95-raised px-1" style={{ fontSize: 9 }}>
                      {f.priority}
                    </span>
                    <span>{f.text}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ))}

      {!ideas?.length && (
        <div className="win95-window max-w-md mx-auto">
          <div className="win95-title-bar">
            <span className="font-vt323">Empty Queue</span>
          </div>
          <div className="p-4 text-center text-sm">No ideas awaiting pricing.</div>
        </div>
      )}
    </div>
  )
}
