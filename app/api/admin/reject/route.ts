import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendIdeaRejected } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { idea_id, rejection_reason } = await request.json() as { idea_id: string; rejection_reason: string }
    if (!idea_id) return NextResponse.json({ error: 'idea_id required.' }, { status: 400 })

    const { error } = await admin
      .from('app_ideas')
      .update({ status: 'rejected', rejection_reason: rejection_reason ?? null })
      .eq('id', idea_id)

    if (error) throw error

    // Email the submitter (non-blocking)
    const { data: idea } = await admin
      .from('app_ideas')
      .select('title, submitter_id')
      .eq('id', idea_id)
      .single()

    if (idea) {
      const { data: submitter } = await admin
        .from('users')
        .select('email')
        .eq('id', idea.submitter_id)
        .single()
      if (submitter?.email) {
        sendIdeaRejected(submitter.email, {
          appTitle: idea.title,
          rejectionReason: rejection_reason ?? null,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/reject error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
