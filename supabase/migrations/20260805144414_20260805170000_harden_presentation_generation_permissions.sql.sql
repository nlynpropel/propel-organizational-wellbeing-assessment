/*
# Harden Presentation Generation — Permissions and Storage

## Summary

This migration tightens security for the presentation generation feature:

1. **RLS tightening on `presentation_generations`**:
   - Drops all existing policies and replaces them with locked-down versions.
   - Superadmin: full CRUD (all rows).
   - Propel CSM: SELECT + INSERT for instances in their organization; UPDATE for their own rows.
   - Propel Sales: SELECT only (can view but not generate).
   - Broker: SELECT only (can download if they can access the assessment instance).
   - No general INSERT/UPDATE/DELETE for authenticated users.

2. **Storage policy tightening on `strategy-presentations` bucket**:
   - Drops all existing storage policies.
   - No general read access for authenticated users.
   - Only superadmin and propel_csm can INSERT (upload).
   - Only superadmin can UPDATE/DELETE.
   - Downloads go through the `download-presentation` edge function which creates signed URLs after access verification.

## Security Changes
- RLS policies on `presentation_generations` tightened.
- Storage policies on `strategy-presentations` bucket locked down.
*/

-- ============================================================
-- 1. Drop ALL existing RLS policies on presentation_generations
-- ============================================================
DROP POLICY IF EXISTS "presentation_gen_superadmin_all" ON presentation_generations;
DROP POLICY IF EXISTS "presentation_gen_propel_select" ON presentation_generations;
DROP POLICY IF EXISTS "presentation_gen_propel_insert" ON presentation_generations;
DROP POLICY IF EXISTS "presentation_gen_propel_update" ON presentation_generations;
DROP POLICY IF EXISTS "presentation_gen_broker_select" ON presentation_generations;

-- ============================================================
-- 2. New RLS policies — locked down
-- ============================================================

-- Superadmin: full access to all rows
CREATE POLICY "presentation_gen_superadmin_all"
  ON presentation_generations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );

-- Propel CSM: SELECT for instances in their organization
CREATE POLICY "presentation_gen_csm_select"
  ON presentation_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'propel_csm'
    )
    AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      JOIN assessment_instances ai ON ai.organization_id = om.organization_id
      WHERE om.profile_id = auth.uid()
        AND om.status = 'active'
        AND ai.id = presentation_generations.assessment_instance_id
    )
  );

-- Propel CSM: INSERT for instances in their organization
CREATE POLICY "presentation_gen_csm_insert"
  ON presentation_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'propel_csm'
    )
    AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      JOIN assessment_instances ai ON ai.organization_id = om.organization_id
      WHERE om.profile_id = auth.uid()
        AND om.status = 'active'
        AND ai.id = assessment_instance_id
    )
  );

-- Propel CSM: UPDATE for rows they can access
CREATE POLICY "presentation_gen_csm_update"
  ON presentation_generations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'propel_csm'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'propel_csm'
    )
  );

-- Propel Sales: SELECT only (view, cannot generate)
CREATE POLICY "presentation_gen_sales_select"
  ON presentation_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'propel_sales'
    )
    AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      JOIN assessment_instances ai ON ai.organization_id = om.organization_id
      WHERE om.profile_id = auth.uid()
        AND om.status = 'active'
        AND ai.id = presentation_generations.assessment_instance_id
    )
  );

-- Broker: SELECT only (download, cannot generate)
CREATE POLICY "presentation_gen_broker_select"
  ON presentation_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'broker'
    )
    AND EXISTS (
      SELECT 1
      FROM assessment_instances ai
      WHERE ai.id = presentation_generations.assessment_instance_id
        AND (
          ai.broker_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM organization_memberships om
            WHERE om.profile_id = auth.uid()
              AND om.status = 'active'
              AND om.organization_id = ai.organization_id
          )
        )
    )
  );

-- ============================================================
-- 3. Drop ALL existing storage policies on strategy-presentations
-- ============================================================
DROP POLICY IF EXISTS "strategy_presentations_read" ON storage.objects;
DROP POLICY IF EXISTS "strategy_presentations_write" ON storage.objects;
DROP POLICY IF EXISTS "strategy_presentations_update" ON storage.objects;
DROP POLICY IF EXISTS "strategy_presentations_delete" ON storage.objects;

-- ============================================================
-- 4. New storage policies — locked down, no general read
-- ============================================================

-- Only superadmin and propel_csm can upload (via edge function with service role)
CREATE POLICY "strategy_presentations_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm')
    )
  );

-- Only superadmin can update
CREATE POLICY "strategy_presentations_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  )
  WITH CHECK (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );

-- Only superadmin can delete
CREATE POLICY "strategy_presentations_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );
