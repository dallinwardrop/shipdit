import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { idea_id } = await request.json() as { idea_id: string }
    if (!idea_id) return NextResponse.json({ error: 'idea_id required.' }, { status: 400 })

    const now = new Date()
    const deadline = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000)

    const { error } = await admin
      .from('app_ideas')
      .update({
        status: 'live',
        live_at: now.toISOString(),
        funding_deadline: deadline.toISOString(),
      })
      .eq('id', idea_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/golive error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
