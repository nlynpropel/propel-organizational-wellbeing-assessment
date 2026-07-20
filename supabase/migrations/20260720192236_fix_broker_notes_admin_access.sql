/*
# Fix: allow active admins to manage broker_notes

1. Purpose
- broker_notes INSERT/UPDATE/DELETE/SELECT own-scoped policies only allowed
  is_active_broker(). An admin user viewing a client detail page could not
  add or manage notes. Allow active admins alongside active brokers on the
  own-scoped policies.

2. Security Changes
- broker_notes_select_own: USING now allows (is_active_broker() OR is_active_admin()).
- broker_notes_insert_own: WITH CHECK now allows (is_active_broker() OR is_active_admin()).
- broker_notes_update_own: USING + WITH CHECK now allow (is_active_broker() OR is_active_admin()).
- broker_notes_delete_own: USING now allows (is_active_broker() OR is_active_admin()).
- The separate broker_notes_*_admin policies already grant full admin access.

3. Idempotent
- DROP IF EXISTS before CREATE.
*/

-- ============================================================
-- broker_notes: select
-- ============================================================
DROP POLICY IF EXISTS "broker_notes_select_own" ON broker_notes;
CREATE POLICY "broker_notes_select_own"
  ON broker_notes FOR SELECT
  TO authenticated
  USING (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));

-- ============================================================
-- broker_notes: insert
-- ============================================================
DROP POLICY IF EXISTS "broker_notes_insert_own" ON broker_notes;
CREATE POLICY "broker_notes_insert_own"
  ON broker_notes FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));

-- ============================================================
-- broker_notes: update
-- ============================================================
DROP POLICY IF EXISTS "broker_notes_update_own" ON broker_notes;
CREATE POLICY "broker_notes_update_own"
  ON broker_notes FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()))
  WITH CHECK (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));

-- ============================================================
-- broker_notes: delete
-- ============================================================
DROP POLICY IF EXISTS "broker_notes_delete_own" ON broker_notes;
CREATE POLICY "broker_notes_delete_own"
  ON broker_notes FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid() AND (is_active_broker() OR is_active_admin()));
