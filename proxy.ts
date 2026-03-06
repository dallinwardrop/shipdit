import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that must never trigger an auth redirect
const BYPASS = ['/login', '/auth/callback', '/api/webhooks/stripe', '/_next', '/favicon']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only enforce auth on /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Safety net: if somehow an excluded path matches, pass through
  if (BYPASS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // On network/auth errors don't redirect — fail open so the page can handle it
    return supabaseResponse
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  let isAdmin = false
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.is_admin ?? false
  } catch {
    // DB error — deny access but don't redirect loop
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*'],
}
