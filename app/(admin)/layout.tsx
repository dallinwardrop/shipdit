import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#008080' }}>
      <nav
        className="win95-raised px-4 py-1 flex items-center gap-3 sticky top-0 z-50"
        style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
      >
        <Link
          href="/admin"
          className="font-vt323 text-2xl"
          style={{ color: '#000080', textDecoration: 'none' }}
        >
          SHIPDIT ADMIN
        </Link>
        <div className="flex gap-1 ml-2 flex-wrap">
          {[
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/pipeline', label: 'Pipeline' },
            { href: '/admin/pricing', label: 'Pricing' },
            { href: '/admin/pledges', label: 'Pledges' },
            { href: '/admin/hosting', label: 'Hosting' },
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/apps', label: 'Apps' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="win95-btn text-xs">
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <Link href="/" className="win95-btn text-xs">
            ← Public Site
          </Link>
        </div>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  )
}
