import Link from 'next/link'
import { NavAuth } from './NavAuth'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#008080' }}>
      {/* Taskbar-style nav */}
      <nav
        className="win95-raised px-4 py-1 flex items-center gap-4 sticky top-0 z-50"
        style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
      >
        <Link
          href="/"
          className="font-vt323 text-2xl"
          style={{ color: '#000080', textDecoration: 'none' }}
        >
          SHIPDIT
        </Link>
        <div className="flex gap-2 ml-2">
          <Link href="/" className="win95-btn text-xs">
            Fund Queue
          </Link>
          <Link href="/submit" className="win95-btn text-xs">
            Submit Idea
          </Link>
          <Link href="/directory" className="win95-btn text-xs">
            Shipd
          </Link>
          <Link href="/donors" className="win95-btn text-xs">
            Donors
          </Link>
          <Link href="/faq" className="win95-btn text-xs">
            FAQ
          </Link>
        </div>
        <div className="ml-auto">
          <NavAuth />
        </div>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  )
}
