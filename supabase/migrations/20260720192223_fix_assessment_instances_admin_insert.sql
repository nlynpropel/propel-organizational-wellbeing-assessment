/*
# Fix: allow active admins to insert/update assessment_instances

1. Purpose
- NewClientPage creates a draft assessment instance immediately after creating
  an organization. The assessment_instances_insert_own policy only allowed
  is_active_broker(), so an admin user would fail the draft-assessment insert
  even after the organization insert was fixed.
- Admins should be able to create and manage assessment instances for their
  organizations, same as brokers.

2. Security Changes
- assessment_instances_insert_own: WITH CHECK now allows
  (is_active_broker() OR is_active_admin()) with the ownership predicate.
- assessment_instances_update_own: USING + WITH CHECK now allow
  (is_active_broker() OR is_active_admin()) with the ownership predicate.
- The separate assessment_instances_*_admin policies already grant full admin
  access, so admins are covered either way — this ensures the own-scoped path
  works for an admin creating instances under their own id.

3. Idempotent
- DROP IF EXISTS before CREATE.
*/

-- ============================================================
-- assessment_instances: insert
-- ============================================================
DROP POLICY IF EXISTS "assessment_instances_insert_own" ON assessment_instances;
CREATE POLICY "assessment_instances_insert_own"
  ON assessment_instances FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));

-- ============================================================
-- assessment_instances: update
-- ============================================================
DROP POLICY IF EXISTS "assessment_instances_update_own" ON assessment_instances;
CREATE POLICY "assessment_instances_update_own"
  ON assessment_instances FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()))
  WITH CHECK (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));
