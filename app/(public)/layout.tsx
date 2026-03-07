import Link from 'next/link'
import { NavAuth } from './NavAuth'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#008080' }}>
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
      <main className="p-4">{children}</main>
    </div>
  )
}
