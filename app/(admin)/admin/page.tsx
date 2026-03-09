export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { AdminDashboard } from './AdminDashboard'
import type { IdeaRow, PledgeRow, UserRow, HostingRow } from './AdminDashboard'

export default async function AdminPage() {
  const admin = createAdminClient()

  const [ideasRes, pledgesRes, usersRes, shippedRes] = await Promise.all([
    admin
      .from('app_ideas')
      .select('id, title, slug, status, amount_raised, build_price, backer_count, created_at, submitter_id, goal_description, features, target_user, similar_apps, platform_preference, submitter_pledge_amount, admin_notes')
      .in('status', ['under_review', 'awaiting_price', 'priced', 'live', 'funded', 'building', 'in_review', 'built'])
      .order('created_at', { ascending: false }),
    admin
      .from('pledges')
      .select('id, amount, type, status, created_at, app_idea_id, user_id')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('users')
      .select('id, email, username, tier, total_pledged, created_at, is_admin')
      .order('created_at', { ascending: false }),
    admin
      .from('app_ideas')
      .select('id, title, slug, hosting_monthly_goal, hosting_collected, hosting_status')
      .eq('status', 'built')
      .order('created_at', { ascending: false }),
  ])

  return (
    <AdminDashboard
      ideas={(ideasRes.data ?? []) as IdeaRow[]}
      pledges={(pledgesRes.data ?? []) as PledgeRow[]}
      users={(usersRes.data ?? []) as UserRow[]}
      shippedIdeas={(shippedRes.data ?? []) as HostingRow[]}
    />
  )
}
