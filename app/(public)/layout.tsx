import Link from 'next/link'
import { NavAuth } from './NavAuth'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#008080' }}>
      {/* Taskbar-style nav */}
      <nav
        className="win95-raised sticky top-0 z-50 overflow-x-auto"
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
      <main className="p-4 flex-1">{children}</main>

      <footer className="win95-raised mt-4" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="px-4 py-2 flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-x-4 sm:gap-y-1">
          <span className="font-vt323 text-lg" style={{ color: '#000080' }}>SHIPDIT</span>
          <span className="text-xs text-center sm:text-left" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
            Community-funded apps, free for everyone.
          </span>
          <div className="flex gap-3 sm:ml-auto">
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
