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

    const { error } = await admin
      .from('app_ideas')
      .update({ status: 'under_review', approved_at: new Date().toISOString() })
      .eq('id', idea_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/approve error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
