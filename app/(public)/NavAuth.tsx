'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function NavAuth() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = getSupabase()

    // Initial session check — use getSession() + getUser() in parallel,
    // whichever resolves first sets the state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setDisplayName(resolveName(session.user))
        setReady(true)
      }
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      setDisplayName(resolveName(user))
      setReady(true)
    })

    // Keep in sync with auth changes; force server re-render on sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setDisplayName(resolveName(session?.user ?? null))
      setReady(true)
      if (event === 'SIGNED_IN') {
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Render nothing until we know auth state (avoids flash)
  if (!ready) return null

  if (displayName) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/pledges" className="win95-btn text-xs">
          My Pledges
        </Link>
        <span
          className="text-xs"
          style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}
        >
          {displayName}
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="win95-btn text-xs"
          style={signingOut ? { borderColor: '#808080 #fff #fff #808080', cursor: 'default', opacity: 0.85 } : {}}
        >
          {signingOut ? '⌛' : 'Sign Out'}
        </button>
      </div>
    )
  }

  return (
    <Link href="/login" className="win95-btn text-xs">
      Sign In
    </Link>
  )
}

function resolveName(user: { user_metadata?: Record<string, unknown>; email?: string } | null): string | null {
  if (!user) return null
  const full = user.user_metadata?.full_name as string | undefined
  return full?.split(' ')[0] ?? user.email?.split('@')[0] ?? null
}
