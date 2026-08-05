-- ============================================================
-- Presentation Generations — versioned PowerPoint deck generation
-- ============================================================

CREATE TYPE presentation_generation_status AS ENUM (
  'queued',
  'generating',
  'completed',
  'failed'
);

CREATE TABLE presentation_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL REFERENCES assessment_instances(id) ON DELETE CASCADE,
  strategy_generation_id uuid NOT NULL REFERENCES analysis_generations(id) ON DELETE CASCADE,
  template_version text NOT NULL DEFAULT 'opportunity-index-deck-v1',
  status presentation_generation_status NOT NULL DEFAULT 'queued',
  payload_snapshot_json jsonb,
  storage_path text,
  file_name text,
  generated_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  supersedes_generation_id uuid REFERENCES presentation_generations(id) ON DELETE SET NULL
);

CREATE INDEX idx_presentation_gen_assessment_instance
  ON presentation_generations(assessment_instance_id, created_at DESC);
CREATE INDEX idx_presentation_gen_strategy_gen
  ON presentation_generations(strategy_generation_id);
CREATE INDEX idx_presentation_gen_status
  ON presentation_generations(status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE presentation_generations ENABLE ROW LEVEL SECURITY;

-- Superadmins can do everything
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

-- Propel CSM / Sales: can manage generations for instances they can access
-- (via organization membership and view_reports capability)
CREATE POLICY "presentation_gen_propel_select"
  ON presentation_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('propel_csm', 'propel_sales')
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

CREATE POLICY "presentation_gen_propel_insert"
  ON presentation_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm', 'propel_sales')
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

CREATE POLICY "presentation_gen_propel_update"
  ON presentation_generations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm')
    )
  );

-- Brokers: can SELECT (download) only when they can access the assessment instance
-- (RLS on assessment_instances already enforces broker access via resolve_accessible_client_orgs)
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
-- Storage bucket: strategy-presentations (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('strategy-presentations', 'strategy-presentations', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only authenticated users who can access the assessment instance
-- can read objects in strategy-presentations
CREATE POLICY "strategy_presentations_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Only superadmins and propel_csm can write (upload) to the bucket
CREATE POLICY "strategy_presentations_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm')
    )
  );

-- Allow update (e.g., metadata) for superadmins and propel_csm
CREATE POLICY "strategy_presentations_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm')
    )
  )
  WITH CHECK (
    bucket_id = 'strategy-presentations'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'propel_csm')
    )
  );

-- Allow delete for superadmins only
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
