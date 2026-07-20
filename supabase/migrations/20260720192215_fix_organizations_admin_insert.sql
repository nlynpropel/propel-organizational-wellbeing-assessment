/*
# Fix: allow active admins to insert/update/delete organizations

1. Purpose
- The organizations INSERT/UPDATE/DELETE policies only allowed active BROKERS
  (is_active_broker()). An active admin user signing in could read organizations
  (via organizations_select_admin) but could NOT create or edit them — the insert
  was silently blocked by RLS, causing "Create Client" to fail for admin users.
- Admins should be able to manage organizations just like brokers. This updates
  the own-scoped INSERT/UPDATE/DELETE policies to accept active admins too.

2. Security Changes
- organizations_insert_own: WITH CHECK now allows broker_id = auth.uid() AND
  (is_active_broker() OR is_active_admin()).
- organizations_update_own: USING + WITH CHECK now allow
  (is_active_broker() OR is_active_admin()) with the ownership predicate.
- organizations_delete_own: USING now allows
  (is_active_broker() OR is_active_admin()) with the ownership predicate.
- The separate organizations_*_admin policies already grant full admin access
  without the ownership predicate, so admins are covered either way — but
  updating the own-scoped policies ensures the insert path works for an admin
  creating an organization under their own id.

3. Idempotent
- DROP IF EXISTS before CREATE.
*/

-- ============================================================
-- organizations: insert
-- ============================================================
DROP POLICY IF EXISTS "organizations_insert_own" ON organizations;
CREATE POLICY "organizations_insert_own"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));

-- ============================================================
-- organizations: update
-- ============================================================
DROP POLICY IF EXISTS "organizations_update_own" ON organizations;
CREATE POLICY "organizations_update_own"
  ON organizations FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()))
  WITH CHECK (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));

-- ============================================================
-- organizations: delete
-- ============================================================
DROP POLICY IF EXISTS "organizations_delete_own" ON organizations;
CREATE POLICY "organizations_delete_own"
  ON organizations FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));
