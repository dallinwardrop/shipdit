export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { NavAuth } from './NavAuth'
import { TickerWrapper } from './TickerWrapper'
import { type TickerItem } from './ActivityTicker'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shipdit.co'

export const metadata: Metadata = {
  title: {
    default: 'Shipdit — Community-Funded Apps',
    template: '%s — Shipdit',
  },
  description: 'Pledge to fund app ideas. Hit the goal, I build it in 72 hours. No subscriptions. No ads. Just backers.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    siteName: 'Shipdit',
    type: 'website',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Shipdit — Community-Funded Apps' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@shipdit',
    images: ['/og-default.png'],
  },
}

function truncate(str: string | null | undefined, max: number) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

async function getTickerItems(): Promise<TickerItem[]> {
  const supabase = createAdminClient()

  const { data: recentIdeas } = await supabase
    .from('app_ideas')
    .select('id, title, status, slug, created_at')
    .in('status', ['submitted', 'under_review', 'live', 'priced', 'funded', 'building', 'in_review', 'built'])
    .order('created_at', { ascending: false })
    .limit(10)

  const combined: TickerItem[] = (recentIdeas ?? []).map((idea) => {
    const t = `"${truncate(idea.title, 32)}"`
    switch (idea.status) {
      case 'submitted':
      case 'under_review':
        return { text: `💡 ${t} was just submitted`, href: `/fund/${idea.slug}` }
      case 'priced':
      case 'live':
        return { text: `🚀 ${t} is now accepting pledges`, href: `/fund/${idea.slug}` }
      case 'funded':
        return { text: `🎉 ${t} just got funded!`, href: `/fund/${idea.slug}` }
      case 'building':
      case 'in_review':
        return { text: `🔨 ${t} is being built`, href: `/fund/${idea.slug}` }
      case 'built':
        return { text: `✅ ${t} has shipped!`, href: `/fund/${idea.slug}` }
      default:
        return { text: `💡 ${t}`, href: `/fund/${idea.slug}` }
    }
  })

  // Interleave support item after every activity item
  const SUPPORT_ITEM: TickerItem = { text: '⭐ Support Shipdit — keep the platform alive', href: '/support' }
  const withSupport: TickerItem[] = []
  combined.forEach((item) => {
    withSupport.push(item)
    withSupport.push(SUPPORT_ITEM)
  })

  // Fallback: at least show the support item if no activity yet
  return withSupport.length > 0 ? withSupport : [SUPPORT_ITEM]
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tickerItems = await getTickerItems()

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#008080' }}>
      {/* Nav + ticker pinned together as one sticky block */}
      <div className="sticky top-0 z-50">
        <nav
          className="win95-raised overflow-x-auto"
          style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
        >
          <div className="px-4 py-1 flex items-center gap-4" style={{ minWidth: 'max-content' }}>
            <Link
              href="/"
              className="font-vt323 text-2xl flex-shrink-0"
              style={{ color: '#000080', textDecoration: 'none' }}
            >
              SHIPDIT
            </Link>
            <div className="flex gap-2">
              <Link href="/" className="win95-btn text-xs">Fund Queue</Link>
              <Link href="/submit" className="win95-btn text-xs">Submit Idea</Link>
              <Link href="/directory" className="win95-btn text-xs">Shipd</Link>
              <Link href="/donors" className="win95-btn text-xs">Donors</Link>
              <Link href="/faq" className="win95-btn text-xs">FAQ</Link>
            </div>
            <div className="ml-auto flex-shrink-0">
              <NavAuth />
            </div>
          </div>
        </nav>

        {/* Activity ticker — hidden on /submit */}
        <TickerWrapper items={tickerItems} />
      </div>

      <main className="p-4 flex-1">{children}</main>

      <footer className="win95-raised mt-4" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="px-4 py-2 flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-x-4 sm:gap-y-1">
          <span className="font-vt323 text-lg" style={{ color: '#000080' }}>SHIPDIT</span>
          <span className="text-xs text-center sm:text-left" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
            No subscriptions. No ads. Just backers.
          </span>
          <div className="flex gap-3 sm:ml-auto">
            <Link href="/support" className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#5a3000', textDecoration: 'none', fontWeight: 'bold' }}>
              ⭐ Support Shipdit
            </Link>
            <Link href="/terms" className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040', textDecoration: 'none' }}>
              Terms
            </Link>
            <Link href="/privacy" className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040', textDecoration: 'none' }}>
              Privacy
            </Link>
            <a href="mailto:dallin@shipdit.co" className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040', textDecoration: 'none' }}>
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
