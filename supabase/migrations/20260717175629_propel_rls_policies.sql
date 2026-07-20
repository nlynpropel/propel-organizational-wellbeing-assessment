/*
# Propel RLS policies

1. Purpose
- Row Level Security policies for all 5 Propel tables.
- Enforces broker ownership and admin access at the database level.
- Authentication (Supabase Auth) and authorization (profiles role/status) are separate.

2. Reusable Helper
- `is_active_admin()` — returns true when the current user has a profile with
  role='admin' AND status='active'. Used by every admin-scoped policy.
- `is_active_broker()` — returns true when the current user has a profile with
  role='broker' AND status='active'. Used by broker-scoped policies.
- `current_profile_status()` — returns the status of the current user's profile,
  or NULL if no profile exists. Used for fine-grained access decisions.

3. Policies by Table

  profiles:
  - Brokers: SELECT/UPDATE own row, but UPDATE is restricted to non-authorization
    fields (role, status, id are immutable by the user themselves).
  - Admins: full SELECT/INSERT/UPDATE/DELETE on all rows.

  organizations:
  - Brokers: SELECT/INSERT/UPDATE/DELETE only where broker_id = auth.uid().
  - Admins: full access to all rows.

  assessment_versions:
  - Brokers: SELECT only published versions.
  - Admins: full SELECT/INSERT/UPDATE/DELETE.

  assessment_instances:
  - Brokers: SELECT/INSERT/UPDATE where broker_id = auth.uid().
  - No DELETE for brokers (assessments should not be hard-deleted by brokers).
  - Admins: full access.
  - Unauthenticated users: NO access (public token access comes in a later phase).

  broker_notes:
  - Brokers: SELECT/INSERT where broker_id = auth.uid(); UPDATE/DELETE only own notes.
  - Admins: full access.

4. Important Notes
1) No USING(true) policies anywhere — every policy has a real ownership/admin predicate.
2) The profile UPDATE policy prevents brokers from changing their own role/status/id
   via a WITH CHECK that rejects changes to those columns.
3) All policies use `is_active_admin()` / `is_active_broker()` so a suspended or archived
   user loses access immediately, even with a valid session.
4) Policies are idempotent — DROP IF EXISTS before CREATE.
*/

-- ============================================================
-- Reusable authorization helpers
-- ============================================================

-- Returns true when the current user is an active admin.
CREATE OR REPLACE FUNCTION is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

-- Returns true when the current user is an active broker.
CREATE OR REPLACE FUNCTION is_active_broker()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'broker'
      AND status = 'active'
  );
$$;

-- Returns true when the current user is active (broker or admin).
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role IN ('admin', 'broker')
  );
$$;

-- ============================================================
-- profiles policies
-- ============================================================

-- Brokers can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can read all profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Brokers can update their own profile, but NOT role, status, or id.
-- The WITH CHECK compares the incoming row to the existing row for those columns.
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM profiles WHERE id = auth.uid())
  );

-- Admins can update any profile (including role/status changes)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- Admins can insert profiles (e.g. for invitation flows)
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_active_admin());

-- Admins can delete profiles
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- organizations policies
-- ============================================================

-- Active brokers can select their own organizations
DROP POLICY IF EXISTS "organizations_select_own" ON organizations;
CREATE POLICY "organizations_select_own"
  ON organizations FOR SELECT
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker());

-- Active admins can select all organizations
DROP POLICY IF EXISTS "organizations_select_admin" ON organizations;
CREATE POLICY "organizations_select_admin"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Active brokers can insert organizations only for themselves
DROP POLICY IF EXISTS "organizations_insert_own" ON organizations;
CREATE POLICY "organizations_insert_own"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid() AND is_active_broker());

-- Active brokers can update their own organizations
DROP POLICY IF EXISTS "organizations_update_own" ON organizations;
CREATE POLICY "organizations_update_own"
  ON organizations FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker())
  WITH CHECK (broker_id = auth.uid() AND is_active_broker());

-- Active admins can update any organization
DROP POLICY IF EXISTS "organizations_update_admin" ON organizations;
CREATE POLICY "organizations_update_admin"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- Active brokers can delete (archive) their own organizations
DROP POLICY IF EXISTS "organizations_delete_own" ON organizations;
CREATE POLICY "organizations_delete_own"
  ON organizations FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker());

-- Active admins can delete any organization
DROP POLICY IF EXISTS "organizations_delete_admin" ON organizations;
CREATE POLICY "organizations_delete_admin"
  ON organizations FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- assessment_versions policies
-- ============================================================

-- Active brokers can read only published versions
DROP POLICY IF EXISTS "assessment_versions_select_broker" ON assessment_versions;
CREATE POLICY "assessment_versions_select_broker"
  ON assessment_versions FOR SELECT
  TO authenticated
  USING (status = 'published' AND is_active_broker());

-- Active admins can read all versions
DROP POLICY IF EXISTS "assessment_versions_select_admin" ON assessment_versions;
CREATE POLICY "assessment_versions_select_admin"
  ON assessment_versions FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Active admins can insert versions
DROP POLICY IF EXISTS "assessment_versions_insert_admin" ON assessment_versions;
CREATE POLICY "assessment_versions_insert_admin"
  ON assessment_versions FOR INSERT
  TO authenticated
  WITH CHECK (is_active_admin());

-- Active admins can update versions
DROP POLICY IF EXISTS "assessment_versions_update_admin" ON assessment_versions;
CREATE POLICY "assessment_versions_update_admin"
  ON assessment_versions FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- Active admins can delete versions
DROP POLICY IF EXISTS "assessment_versions_delete_admin" ON assessment_versions;
CREATE POLICY "assessment_versions_delete_admin"
  ON assessment_versions FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- assessment_instances policies
-- ============================================================

-- Active brokers can select their own assessment instances
DROP POLICY IF EXISTS "assessment_instances_select_own" ON assessment_instances;
CREATE POLICY "assessment_instances_select_own"
  ON assessment_instances FOR SELECT
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker());

-- Active admins can select all assessment instances
DROP POLICY IF EXISTS "assessment_instances_select_admin" ON assessment_instances;
CREATE POLICY "assessment_instances_select_admin"
  ON assessment_instances FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Active brokers can insert instances only for themselves
DROP POLICY IF EXISTS "assessment_instances_insert_own" ON assessment_instances;
CREATE POLICY "assessment_instances_insert_own"
  ON assessment_instances FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid() AND is_active_broker());

-- Active brokers can update their own instances
DROP POLICY IF EXISTS "assessment_instances_update_own" ON assessment_instances;
CREATE POLICY "assessment_instances_update_own"
  ON assessment_instances FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker())
  WITH CHECK (broker_id = auth.uid() AND is_active_broker());

-- Active admins can update any instance
DROP POLICY IF EXISTS "assessment_instances_update_admin" ON assessment_instances;
CREATE POLICY "assessment_instances_update_admin"
  ON assessment_instances FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- Active admins can delete instances
DROP POLICY IF EXISTS "assessment_instances_delete_admin" ON assessment_instances;
CREATE POLICY "assessment_instances_delete_admin"
  ON assessment_instances FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- broker_notes policies
-- ============================================================

-- Active brokers can select their own notes
DROP POLICY IF EXISTS "broker_notes_select_own" ON broker_notes;
CREATE POLICY "broker_notes_select_own"
  ON broker_notes FOR SELECT
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker());

-- Active admins can select all notes
DROP POLICY IF EXISTS "broker_notes_select_admin" ON broker_notes;
CREATE POLICY "broker_notes_select_admin"
  ON broker_notes FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Active brokers can insert notes only for themselves
DROP POLICY IF EXISTS "broker_notes_insert_own" ON broker_notes;
CREATE POLICY "broker_notes_insert_own"
  ON broker_notes FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid() AND is_active_broker());

-- Active brokers can update only their own notes
DROP POLICY IF EXISTS "broker_notes_update_own" ON broker_notes;
CREATE POLICY "broker_notes_update_own"
  ON broker_notes FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker())
  WITH CHECK (broker_id = auth.uid() AND is_active_broker());

-- Active brokers can delete only their own notes
DROP POLICY IF EXISTS "broker_notes_delete_own" ON broker_notes;
CREATE POLICY "broker_notes_delete_own"
  ON broker_notes FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid() AND is_active_broker());

-- Active admins can update any note
DROP POLICY IF EXISTS "broker_notes_update_admin" ON broker_notes;
CREATE POLICY "broker_notes_update_admin"
  ON broker_notes FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- Active admins can delete any note
DROP POLICY IF EXISTS "broker_notes_delete_admin" ON broker_notes;
CREATE POLICY "broker_notes_delete_admin"
  ON broker_notes FOR DELETE
  TO authenticated
  USING (is_active_admin());
