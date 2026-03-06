export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDollars, progressPercent } from '@/lib/utils'
import { HostingContribute } from './HostingContribute'
import { CopyButton } from './CopyButton'

export default async function HostingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: idea } = await admin
    .from('app_ideas')
    .select('id, title, slug, goal_description, hosting_monthly_goal, hosting_collected, hosting_status')
    .eq('slug', slug)
    .eq('status', 'built')
    .single()

  if (!idea) notFound()

  const { data: liveApp } = await admin
    .from('live_apps')
    .select('official_name, subdomain, is_online')
    .eq('app_idea_id', idea.id)
    .single()

  const goal = idea.hosting_monthly_goal ?? 0
  const collected = idea.hosting_collected ?? 0
  const pct = goal > 0 ? progressPercent(collected, goal) : 0
  const isOffline = idea.hosting_status === 'offline'
  const isWarning = idea.hosting_status === 'warning'
  const appName = liveApp?.official_name ?? idea.title
  const appUrl = liveApp ? `https://${liveApp.subdomain}.shipdit.co` : null

  const meterColor = pct >= 50 ? '#006600' : pct >= 25 ? '#886600' : '#cc0000'

  // Widget embed snippet (static snapshot)
  const widgetSnippet = `<div style="font-family:monospace;font-size:12px;padding:8px 12px;background:#f0f0f0;border:1px solid #c0c0c0;max-width:320px;">
  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shipdit.co'}/hosting/${slug}" target="_blank" style="text-decoration:none;color:inherit;">
    <div style="margin-bottom:4px;font-weight:bold;">Keep ${appName} free — contribute to hosting</div>
    <div style="height:8px;background:#d0d0d0;border-radius:2px;overflow:hidden;margin-bottom:4px;">
      <div style="height:100%;width:${pct}%;background:${meterColor};"></div>
    </div>
    <div style="color:#404040;">${pct}% of this month's hosting funded · shipdit.co</div>
  </a>
</div>`

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl truncate flex-1">{appName}</span>
          {isOffline && (
            <span className="text-xs px-1" style={{ background: '#cc0000', color: '#fff', fontFamily: 'Share Tech Mono, monospace' }}>
              OFFLINE
            </span>
          )}
          {isWarning && !isOffline && (
            <span className="text-xs px-1" style={{ background: '#886600', color: '#fff', fontFamily: 'Share Tech Mono, monospace' }}>
              WARNING
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          <h1 className="font-vt323 text-4xl" style={{ color: '#000080' }}>{appName}</h1>
          {idea.goal_description && <p className="text-sm">{idea.goal_description}</p>}
          {appUrl && (
            <a href={appUrl} target="_blank" rel="noopener noreferrer" className="win95-btn text-xs inline-block">
              Open App →
            </a>
          )}
        </div>
      </div>

      {/* Offline alert */}
      {isOffline && (
        <div className="win95-window">
          <div className="win95-title-bar" style={{ background: '#800000' }}>
            <span className="font-vt323 text-lg">App Offline</span>
          </div>
          <div
            className="p-3 text-sm"
            style={{ fontFamily: 'Share Tech Mono, monospace', background: '#fff0f0', color: 'darkred' }}
          >
            This app is currently offline due to unpaid hosting. Help bring it back!
          </div>
        </div>
      )}

      {/* Hosting meter */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">This Month's Hosting</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
            Community contributions cover server costs and keep this app free for everyone.
          </p>
          {goal > 0 ? (
            <div className="space-y-2">
              <div className="win95-progress-track">
                <div
                  className="win95-progress-fill"
                  style={{ width: `${pct}%`, background: meterColor }}
                />
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                <span>{formatDollars(collected)} of {formatDollars(goal)} this month</span>
                <span style={{ fontWeight: 'bold', color: pct >= 100 ? 'green' : 'inherit' }}>{pct}%</span>
              </div>
            </div>
          ) : (
            <div className="win95-sunken p-2 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
              Hosting goal not yet set.
            </div>
          )}
        </div>
      </div>

      {/* Contribution form */}
      <HostingContribute appIdeaId={idea.id} slug={slug} appName={appName} />

      {/* Widget embed snippet */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">Embed Widget</span>
        </div>
        <div className="p-3 space-y-2">
          <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
            Paste this into your app to show the hosting meter and drive contributions:
          </p>
          <div className="win95-sunken p-2">
            <pre
              className="text-xs overflow-x-auto whitespace-pre-wrap"
              style={{ fontFamily: 'Share Tech Mono, monospace', margin: 0 }}
            >
              {widgetSnippet}
            </pre>
          </div>
          <CopyButton text={widgetSnippet} label="Copy Snippet" />
        </div>
      </div>

    </div>
  )
}
