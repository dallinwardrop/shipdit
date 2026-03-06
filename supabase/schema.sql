-- ============================================================
-- SHIPDIT DATABASE SCHEMA
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE idea_status AS ENUM (
  'submitted',
  'under_review',
  'awaiting_price',
  'priced',
  'live',
  'funded',
  'building',
  'in_review',
  'built',
  'rejected',
  'expired'
);

CREATE TYPE pledge_type AS ENUM ('watch', 'pledge', 'hosting');

CREATE TYPE pledge_status AS ENUM ('pending', 'held', 'captured', 'refunded', 'failed');

CREATE TYPE user_tier AS ENUM ('watcher', 'supporter', 'backer', 'patron', 'legend');

CREATE TYPE email_type AS ENUM (
  'submission_confirmed',
  'idea_approved',
  'idea_live',
  'goal_hit',
  'backer_update',
  'hosting_warning',
  'hosting_expired',
  'refund_issued'
);

CREATE TYPE build_status AS ENUM ('not_started', 'in_progress', 'demo_ready', 'shipped');

-- ============================================================
-- TABLES
-- ============================================================

-- users: mirrors auth.users, extended profile
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  username text UNIQUE,
  is_admin boolean DEFAULT false,
  tier user_tier DEFAULT 'watcher',
  total_pledged integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- app_ideas
CREATE TABLE public.app_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text UNIQUE,
  goal_description text NOT NULL,
  features jsonb DEFAULT '[]',
  target_user text NOT NULL,
  similar_apps text,
  platform_preference text DEFAULT 'web',
  submitter_pledge_amount integer NOT NULL,
  status idea_status DEFAULT 'submitted',
  build_price integer,
  build_time_estimate text,
  build_status build_status DEFAULT 'not_started',
  demo_url text,
  amount_raised integer DEFAULT 0,
  backer_count integer DEFAULT 0,
  watcher_count integer DEFAULT 0,
  funding_deadline timestamptz,
  admin_notes text,
  rejection_reason text,
  referral_code text UNIQUE,
  approved_at timestamptz,
  priced_at timestamptz,
  live_at timestamptz,
  funded_at timestamptz,
  built_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- pledges
CREATE TABLE public.pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  app_idea_id uuid NOT NULL REFERENCES public.app_ideas(id) ON DELETE RESTRICT,
  amount integer NOT NULL,
  type pledge_type NOT NULL,
  status pledge_status DEFAULT 'pending',
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  ref_code text,
  is_submitter_pledge boolean DEFAULT false,
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- live_apps
CREATE TABLE public.live_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_idea_id uuid UNIQUE NOT NULL REFERENCES public.app_ideas(id) ON DELETE RESTRICT,
  official_name text NOT NULL,
  name_proposed_by uuid REFERENCES public.users(id),
  subdomain text UNIQUE NOT NULL,
  is_online boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  hosting_expires_at timestamptz NOT NULL,
  hosting_fund_balance integer DEFAULT 0,
  user_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- hosting_donations
CREATE TABLE public.hosting_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_app_id uuid NOT NULL REFERENCES public.live_apps(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount integer NOT NULL,
  months_purchased integer GENERATED ALWAYS AS (amount / 100000) STORED,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- referrals
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_idea_id uuid NOT NULL REFERENCES public.app_ideas(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ref_code text UNIQUE NOT NULL,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- backer_updates
CREATE TABLE public.backer_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_idea_id uuid NOT NULL REFERENCES public.app_ideas(id) ON DELETE CASCADE,
  body text NOT NULL,
  build_status build_status NOT NULL,
  demo_url text,
  created_at timestamptz DEFAULT now()
);

-- email_log
CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_user_id uuid REFERENCES public.users(id),
  to_email text NOT NULL,
  subject text NOT NULL,
  type email_type NOT NULL,
  app_idea_id uuid REFERENCES public.app_ideas(id),
  resend_id text,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Generate a URL-safe slug from a title
CREATE OR REPLACE FUNCTION generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;

  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.app_ideas WHERE slug = final_slug);
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- Generate an 8-character random referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  code text := '';
  i integer;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.app_ideas WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Compute user tier from total_pledged (in cents)
CREATE OR REPLACE FUNCTION compute_tier(total_pledged_cents integer)
RETURNS user_tier
LANGUAGE plpgsql
AS $$
BEGIN
  IF total_pledged_cents >= 1500000 THEN RETURN 'legend';
  ELSIF total_pledged_cents >= 500000 THEN RETURN 'patron';
  ELSIF total_pledged_cents >= 50000 THEN RETURN 'backer';
  ELSIF total_pledged_cents >= 10000 THEN RETURN 'supporter';
  ELSE RETURN 'watcher';
  END IF;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Auto-create public.users row on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- 2. Recalculate app_ideas aggregate stats when a pledge is inserted/updated
CREATE OR REPLACE FUNCTION recalculate_idea_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idea_id uuid;
BEGIN
  v_idea_id := COALESCE(NEW.app_idea_id, OLD.app_idea_id);

  UPDATE public.app_ideas SET
    amount_raised = COALESCE((
      SELECT SUM(amount)
      FROM public.pledges
      WHERE app_idea_id = v_idea_id
        AND status IN ('held', 'captured')
    ), 0),
    backer_count = COALESCE((
      SELECT COUNT(*)
      FROM public.pledges
      WHERE app_idea_id = v_idea_id
        AND type = 'pledge'
        AND status IN ('held', 'captured')
    ), 0),
    watcher_count = COALESCE((
      SELECT COUNT(*)
      FROM public.pledges
      WHERE app_idea_id = v_idea_id
        AND type = 'watch'
        AND status IN ('held', 'captured')
    ), 0)
  WHERE id = v_idea_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_pledge_stats_change
  AFTER INSERT OR UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION recalculate_idea_stats();

-- 3. Auto-mark idea as funded when amount_raised >= build_price
CREATE OR REPLACE FUNCTION check_idea_funded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.build_price IS NOT NULL
     AND NEW.amount_raised >= NEW.build_price
     AND NEW.funded_at IS NULL
     AND NEW.status = 'live' THEN
    NEW.funded_at := now();
    NEW.status := 'funded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_idea_maybe_funded
  BEFORE UPDATE ON public.app_ideas
  FOR EACH ROW EXECUTE FUNCTION check_idea_funded();

-- 4. Recalculate users.total_pledged and tier on captured pledge
CREATE OR REPLACE FUNCTION recalculate_user_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_total integer;
BEGIN
  -- Only act when status is or becomes 'captured'
  IF (TG_OP = 'INSERT' AND NEW.status = 'captured')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'captured' AND (OLD.status IS DISTINCT FROM 'captured')) THEN
    v_user_id := NEW.user_id;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_total
      FROM public.pledges
     WHERE user_id = v_user_id
       AND status = 'captured';

    UPDATE public.users
       SET total_pledged = v_total,
           tier = compute_tier(v_total)
     WHERE id = v_user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_pledge_captured
  AFTER INSERT OR UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION recalculate_user_tier();

-- 5. Increment referral conversions when a pledge has a ref_code
CREATE OR REPLACE FUNCTION handle_referral_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ref_code IS NOT NULL THEN
    UPDATE public.referrals
       SET conversions = conversions + 1
     WHERE ref_code = NEW.ref_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_pledge_referral
  AFTER INSERT ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION handle_referral_conversion();

-- 6. Extend hosting_expires_at on new hosting donation
CREATE OR REPLACE FUNCTION handle_hosting_donation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_apps
     SET hosting_expires_at = hosting_expires_at + (NEW.months_purchased || ' months')::interval,
         hosting_fund_balance = hosting_fund_balance + NEW.amount
   WHERE id = NEW.live_app_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_hosting_donation_insert
  AFTER INSERT ON public.hosting_donations
  FOR EACH ROW EXECUTE FUNCTION handle_hosting_donation();

-- Auto-set slug and referral_code on app_ideas insert
CREATE OR REPLACE FUNCTION set_idea_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_idea_insert_defaults
  BEFORE INSERT ON public.app_ideas
  FOR EACH ROW EXECUTE FUNCTION set_idea_defaults();

-- Auto-set funding_deadline when idea goes live
CREATE OR REPLACE FUNCTION set_funding_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' AND NEW.live_at IS NULL THEN
    NEW.live_at := now();
    NEW.funding_deadline := now() + interval '120 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_idea_goes_live
  BEFORE UPDATE ON public.app_ideas
  FOR EACH ROW EXECUTE FUNCTION set_funding_deadline();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backer_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- ── users ────────────────────────────────────────────────────

-- Public read: safe columns only (admin_notes-equivalent is is_admin — excluded via view approach)
CREATE POLICY "users_public_read" ON public.users
  FOR SELECT USING (true);

-- Users can update their own row
CREATE POLICY "users_own_update" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do anything (used by triggers and API routes)
CREATE POLICY "users_service_all" ON public.users
  USING (auth.role() = 'service_role');

-- ── app_ideas ────────────────────────────────────────────────

-- Public read for published ideas (admin_notes excluded via column-level: use a view or API layer)
CREATE POLICY "ideas_public_read" ON public.app_ideas
  FOR SELECT USING (
    status IN ('live', 'funded', 'building', 'in_review', 'built')
  );

-- Admins can read all ideas
CREATE POLICY "ideas_admin_read_all" ON public.app_ideas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can write all ideas
CREATE POLICY "ideas_admin_write" ON public.app_ideas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Authenticated users can insert ideas
CREATE POLICY "ideas_auth_insert" ON public.app_ideas
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);

-- Service role full access
CREATE POLICY "ideas_service_all" ON public.app_ideas
  USING (auth.role() = 'service_role');

-- ── pledges ──────────────────────────────────────────────────

CREATE POLICY "pledges_own_read" ON public.pledges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pledges_admin_read" ON public.pledges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "pledges_auth_insert" ON public.pledges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pledges_service_all" ON public.pledges
  USING (auth.role() = 'service_role');

-- ── live_apps ────────────────────────────────────────────────

CREATE POLICY "live_apps_public_read" ON public.live_apps
  FOR SELECT USING (is_online = true);

CREATE POLICY "live_apps_admin_write" ON public.live_apps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "live_apps_service_all" ON public.live_apps
  USING (auth.role() = 'service_role');

-- ── referrals ────────────────────────────────────────────────

CREATE POLICY "referrals_owner_read" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);

CREATE POLICY "referrals_service_all" ON public.referrals
  USING (auth.role() = 'service_role');

-- ── hosting_donations ────────────────────────────────────────

CREATE POLICY "hosting_donations_public_read" ON public.hosting_donations
  FOR SELECT USING (true);

CREATE POLICY "hosting_donations_auth_insert" ON public.hosting_donations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hosting_donations_service_all" ON public.hosting_donations
  USING (auth.role() = 'service_role');

-- ── backer_updates ───────────────────────────────────────────

CREATE POLICY "backer_updates_public_read" ON public.backer_updates
  FOR SELECT USING (true);

CREATE POLICY "backer_updates_admin_insert" ON public.backer_updates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "backer_updates_service_all" ON public.backer_updates
  USING (auth.role() = 'service_role');

-- ── email_log ────────────────────────────────────────────────

CREATE POLICY "email_log_admin_only" ON public.email_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "email_log_service_all" ON public.email_log
  USING (auth.role() = 'service_role');

-- ============================================================
-- INDEXES (performance)
-- ============================================================

CREATE INDEX idx_app_ideas_status ON public.app_ideas(status);
CREATE INDEX idx_app_ideas_slug ON public.app_ideas(slug);
CREATE INDEX idx_app_ideas_submitter ON public.app_ideas(submitter_id);
CREATE INDEX idx_pledges_user ON public.pledges(user_id);
CREATE INDEX idx_pledges_idea ON public.pledges(app_idea_id);
CREATE INDEX idx_pledges_status ON public.pledges(status);
CREATE INDEX idx_referrals_code ON public.referrals(ref_code);
CREATE INDEX idx_hosting_donations_app ON public.hosting_donations(live_app_id);
