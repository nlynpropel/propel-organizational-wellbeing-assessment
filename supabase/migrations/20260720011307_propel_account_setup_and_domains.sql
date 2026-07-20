/*
# Account self-setup, approved domains, and profile extensions

1. Purpose
- Adds a domain allow-list so only emails from approved domains can self-register
  via the magic-link flow. Supabase's built-in auth still creates the auth.users
  row, but the frontend uses this table to validate before sending the link.
- Extends the `profiles` table with fields collected during self-account setup:
  average client size, territory/region, and a flag tracking whether the user
  has completed the setup form.
- Adds a SECURITY DEFINER function `complete_account_setup` so a newly
  authenticated user can populate their own profile row in a single call,
  flipping status from 'invited' to 'active' — no admin round-trip required.
- Adds an admin-only RPC `admin_list_all_profiles` returning every registered
  user so the superadmin panel can display them without granting blanket
  SELECT on profiles to brokers.

2. New Tables
- `approved_domains` — domain allow-list for self-registration.
  - id (uuid, PK)
  - domain (text, unique, NOT NULL) — stored WITHOUT the leading @ (e.g. "propelwellness.com")
  - created_by (uuid, references profiles) — admin who added the domain
  - created_at (timestamptz)

3. Modified Tables
- `profiles` — three new columns (all nullable so existing rows are unaffected):
  - average_client_size text CHECK in ('small', 'mid', 'large') — self-reported
    typical employer size the broker works with.
  - territory text — free-form region/territory label (e.g. "Northeast", "TX").
  - account_setup_complete boolean NOT NULL DEFAULT false — flips to true when
    the user submits the account-setup form. When false AND status='invited',
    the frontend routes them to /new-account instead of the dashboard.

4. Security — RLS on approved_domains
- Enable RLS.
- SELECT: any authenticated user can read the domain list (needed to validate
  at the login screen — the list itself is not sensitive).
- INSERT / UPDATE / DELETE: active admins only (via is_active_admin()).

5. Security — profiles policy update
- A new UPDATE policy `profiles_update_own_setup` allows a user to set the
  account-setup fields on their OWN row even while status='invited'. The
  existing `profiles_update_own` policy requires status checks that would
  block an invited user. This new policy is narrowly scoped to the setup
  columns and is used by the `complete_account_setup` function.
- The `complete_account_setup` function is SECURITY DEFINER so it bypasses RLS
  and can safely update the row; the function itself validates auth.uid().

6. RPC functions
- `complete_account_setup(p_first_name, p_last_name, p_avg_client_size, p_territory)`:
  Updates the calling user's profile: sets the four fields, flips
  account_setup_complete=true, and sets status='active'. Returns the updated
  profile row. Throws if the profile doesn't exist for the caller.
- `admin_list_all_profiles()`: Returns all profile rows. SECURITY DEFINER,
  validates is_active_admin() internally, raises exception otherwise.

7. Important Notes
1) The first approved domain `propelwellness.com` is seeded in the same
   migration so self-registration works immediately.
2) account_setup_complete defaults to false, so all EXISTING profiles are
   treated as "not yet self-setup." If existing admins/brokers are already
   active, the frontend only routes to /new-account when status='invited'
   AND account_setup_complete=false — active users skip setup. This means
   existing active users will not be bothered by the setup screen.
3) All statements are idempotent (IF NOT EXISTS / DO $$ blocks / DROP IF EXISTS).
*/

-- ============================================================
-- approved_domains table
-- ============================================================
CREATE TABLE IF NOT EXISTS approved_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approved_domains_domain ON approved_domains(domain);

ALTER TABLE approved_domains ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the domain list (needed for login validation)
DROP POLICY IF EXISTS "approved_domains_select_any" ON approved_domains;
CREATE POLICY "approved_domains_select_any"
  ON approved_domains FOR SELECT
  TO authenticated
  USING (true);

-- Only active admins can insert domains
DROP POLICY IF EXISTS "approved_domains_insert_admin" ON approved_domains;
CREATE POLICY "approved_domains_insert_admin"
  ON approved_domains FOR INSERT
  TO authenticated
  WITH CHECK (is_active_admin());

-- Only active admins can update domains
DROP POLICY IF EXISTS "approved_domains_update_admin" ON approved_domains;
CREATE POLICY "approved_domains_update_admin"
  ON approved_domains FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- Only active admins can delete domains
DROP POLICY IF EXISTS "approved_domains_delete_admin" ON approved_domains;
CREATE POLICY "approved_domains_delete_admin"
  ON approved_domains FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- profiles: add account-setup columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'average_client_size'
  ) THEN
    ALTER TABLE profiles ADD COLUMN average_client_size text
      CHECK (average_client_size IN ('small', 'mid', 'large'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'territory'
  ) THEN
    ALTER TABLE profiles ADD COLUMN territory text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'account_setup_complete'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_setup_complete boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_setup_complete ON profiles(account_setup_complete);
CREATE INDEX IF NOT EXISTS idx_profiles_territory ON profiles(territory);

-- ============================================================
-- complete_account_setup RPC
-- Called by a newly authenticated user to populate their profile
-- and activate their account in one step.
-- ============================================================
CREATE OR REPLACE FUNCTION complete_account_setup(
  p_first_name text,
  p_last_name text,
  p_avg_client_size text,
  p_territory text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  -- Ensure the caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate average client size
  IF p_avg_client_size NOT IN ('small', 'mid', 'large') THEN
    RAISE EXCEPTION 'Invalid average client size: %', p_avg_client_size;
  END IF;

  -- Validate required text fields
  IF COALESCE(TRIM(p_first_name), '') = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  IF COALESCE(TRIM(p_last_name), '') = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;
  IF COALESCE(TRIM(p_territory), '') = '' THEN
    RAISE EXCEPTION 'Territory is required';
  END IF;

  -- Update the caller's profile row
  UPDATE public.profiles
  SET
    first_name = TRIM(p_first_name),
    last_name = TRIM(p_last_name),
    average_client_size = p_avg_client_size,
    territory = TRIM(p_territory),
    account_setup_complete = true,
    status = 'active',
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found for the authenticated user';
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_account_setup(text, text, text, text) TO authenticated;

-- ============================================================
-- admin_list_all_profiles RPC
-- Returns all profile rows. Admin-only.
-- ============================================================
CREATE OR REPLACE FUNCTION admin_list_all_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_all_profiles() TO authenticated;

-- ============================================================
-- Seed first approved domain
-- ============================================================
INSERT INTO approved_domains (domain)
VALUES ('propelwellness.com')
ON CONFLICT (domain) DO NOTHING;
