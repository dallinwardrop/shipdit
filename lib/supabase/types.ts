export type IdeaStatus =
  | 'submitted'
  | 'under_review'
  | 'awaiting_price'
  | 'priced'
  | 'live'
  | 'funded'
  | 'building'
  | 'in_review'
  | 'built'
  | 'rejected'
  | 'expired'

export type PledgeType = 'watch' | 'pledge' | 'hosting'
export type PledgeStatus = 'pending' | 'held' | 'captured' | 'refunded' | 'failed'
export type UserTier = 'watcher' | 'supporter' | 'backer' | 'patron' | 'legend'
export type EmailType =
  | 'submission_confirmed'
  | 'idea_approved'
  | 'idea_live'
  | 'goal_hit'
  | 'backer_update'
  | 'hosting_warning'
  | 'hosting_expired'
  | 'refund_issued'
export type BuildStatus = 'not_started' | 'in_progress' | 'demo_ready' | 'shipped'

export type FeatureItem = {
  priority: 'MUST HAVE' | 'SHOULD HAVE' | 'NICE TO HAVE'
  text: string
}

// Supabase-compatible Database type.
// Each table requires Row / Insert / Update / Relationships.
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          username: string | null
          is_admin: boolean
          tier: UserTier
          total_pledged: number
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          username?: string | null
          is_admin?: boolean
          tier?: UserTier
          total_pledged?: number
          created_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          username?: string | null
          is_admin?: boolean
          tier?: UserTier
          total_pledged?: number
        }
        Relationships: []
      }
      app_ideas: {
        Row: {
          id: string
          submitter_id: string
          title: string
          slug: string | null
          app_number: number | null
          goal_description: string
          features: FeatureItem[]
          target_user: string
          similar_apps: string | null
          platform_preference: string
          submitter_pledge_amount: number
          status: IdeaStatus
          build_price: number | null
          build_time_estimate: string | null
          build_status: BuildStatus
          demo_url: string | null
          amount_raised: number
          backer_count: number
          watcher_count: number
          funding_deadline: string | null
          admin_notes: string | null
          rejection_reason: string | null
          referral_code: string | null
          approved_at: string | null
          priced_at: string | null
          live_at: string | null
          funded_at: string | null
          built_at: string | null
          hosting_monthly_goal: number
          hosting_collected: number
          hosting_period_start: string | null
          hosting_status: string
          created_at: string
        }
        Insert: {
          id?: string
          submitter_id: string
          title: string
          slug?: string | null
          app_number?: number | null
          goal_description: string
          features?: FeatureItem[]
          target_user: string
          similar_apps?: string | null
          platform_preference?: string
          submitter_pledge_amount: number
          status?: IdeaStatus
          build_price?: number | null
          build_time_estimate?: string | null
          build_status?: BuildStatus
          demo_url?: string | null
          amount_raised?: number
          backer_count?: number
          watcher_count?: number
          funding_deadline?: string | null
          admin_notes?: string | null
          rejection_reason?: string | null
          referral_code?: string | null
          approved_at?: string | null
          priced_at?: string | null
          live_at?: string | null
          funded_at?: string | null
          built_at?: string | null
          hosting_monthly_goal?: number
          hosting_collected?: number
          hosting_period_start?: string | null
          hosting_status?: string
          created_at?: string
        }
        Update: {
          submitter_id?: string
          title?: string
          slug?: string | null
          app_number?: number | null
          goal_description?: string
          features?: FeatureItem[]
          target_user?: string
          similar_apps?: string | null
          platform_preference?: string
          submitter_pledge_amount?: number
          status?: IdeaStatus
          build_price?: number | null
          build_time_estimate?: string | null
          build_status?: BuildStatus
          demo_url?: string | null
          amount_raised?: number
          backer_count?: number
          watcher_count?: number
          funding_deadline?: string | null
          admin_notes?: string | null
          rejection_reason?: string | null
          referral_code?: string | null
          approved_at?: string | null
          priced_at?: string | null
          live_at?: string | null
          funded_at?: string | null
          built_at?: string | null
          hosting_monthly_goal?: number
          hosting_collected?: number
          hosting_period_start?: string | null
          hosting_status?: string
        }
        Relationships: []
      }
      pledges: {
        Row: {
          id: string
          user_id: string
          app_idea_id: string
          amount: number
          type: PledgeType
          status: PledgeStatus
          stripe_payment_intent_id: string
          stripe_customer_id: string | null
          ref_code: string | null
          is_submitter_pledge: boolean
          anonymous: boolean
          captured_at: string | null
          refunded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          app_idea_id: string
          amount: number
          type: PledgeType
          status?: PledgeStatus
          stripe_payment_intent_id: string
          stripe_customer_id?: string | null
          ref_code?: string | null
          is_submitter_pledge?: boolean
          anonymous?: boolean
          captured_at?: string | null
          refunded_at?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          app_idea_id?: string
          amount?: number
          type?: PledgeType
          status?: PledgeStatus
          stripe_payment_intent_id?: string
          stripe_customer_id?: string | null
          ref_code?: string | null
          is_submitter_pledge?: boolean
          anonymous?: boolean
          captured_at?: string | null
          refunded_at?: string | null
        }
        Relationships: []
      }
      live_apps: {
        Row: {
          id: string
          app_idea_id: string
          official_name: string
          name_proposed_by: string | null
          subdomain: string
          is_online: boolean
          is_featured: boolean
          hosting_expires_at: string
          hosting_fund_balance: number
          user_count: number
          created_at: string
        }
        Insert: {
          id?: string
          app_idea_id: string
          official_name: string
          name_proposed_by?: string | null
          subdomain: string
          is_online?: boolean
          is_featured?: boolean
          hosting_expires_at: string
          hosting_fund_balance?: number
          user_count?: number
          created_at?: string
        }
        Update: {
          app_idea_id?: string
          official_name?: string
          name_proposed_by?: string | null
          subdomain?: string
          is_online?: boolean
          is_featured?: boolean
          hosting_expires_at?: string
          hosting_fund_balance?: number
          user_count?: number
        }
        Relationships: []
      }
      hosting_contributions: {
        Row: {
          id: string
          app_idea_id: string
          user_id: string | null
          amount: number
          stripe_payment_intent_id: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          app_idea_id: string
          user_id?: string | null
          amount: number
          stripe_payment_intent_id?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          app_idea_id?: string
          user_id?: string | null
          amount?: number
          stripe_payment_intent_id?: string | null
          status?: string
        }
        Relationships: []
      }
      hosting_donations: {
        Row: {
          id: string
          live_app_id: string
          user_id: string
          amount: number
          months_purchased: number
          stripe_payment_intent_id: string
          created_at: string
        }
        Insert: {
          id?: string
          live_app_id: string
          user_id: string
          amount: number
          stripe_payment_intent_id: string
          created_at?: string
        }
        Update: {
          live_app_id?: string
          user_id?: string
          amount?: number
          stripe_payment_intent_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          id: string
          app_idea_id: string
          referrer_user_id: string
          ref_code: string
          clicks: number
          conversions: number
          created_at: string
        }
        Insert: {
          id?: string
          app_idea_id: string
          referrer_user_id: string
          ref_code: string
          clicks?: number
          conversions?: number
          created_at?: string
        }
        Update: {
          app_idea_id?: string
          referrer_user_id?: string
          ref_code?: string
          clicks?: number
          conversions?: number
        }
        Relationships: []
      }
      backer_updates: {
        Row: {
          id: string
          app_idea_id: string
          body: string
          build_status: BuildStatus
          demo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          app_idea_id: string
          body: string
          build_status: BuildStatus
          demo_url?: string | null
          created_at?: string
        }
        Update: {
          app_idea_id?: string
          body?: string
          build_status?: BuildStatus
          demo_url?: string | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          id: string
          to_user_id: string | null
          to_email: string
          subject: string
          type: EmailType
          app_idea_id: string | null
          resend_id: string | null
          status: string
          sent_at: string
        }
        Insert: {
          id?: string
          to_user_id?: string | null
          to_email: string
          subject: string
          type: EmailType
          app_idea_id?: string | null
          resend_id?: string | null
          status?: string
          sent_at?: string
        }
        Update: {
          to_user_id?: string | null
          to_email?: string
          subject?: string
          type?: EmailType
          app_idea_id?: string | null
          resend_id?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      idea_status: IdeaStatus
      pledge_type: PledgeType
      pledge_status: PledgeStatus
      user_tier: UserTier
      email_type: EmailType
      build_status: BuildStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
