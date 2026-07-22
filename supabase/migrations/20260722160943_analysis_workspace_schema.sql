/*
# Strategy Analysis Workspace Schema

## Purpose
Create a neutral Strategy Analysis workspace that can be used by Propel,
brokerages, and future non-broker organizations. Workspaces link to a
finalized assessment instance and hold outcome goals, outcome metrics,
and analyst notes.

## New Tables

### 1. analysis_workspaces
- id (uuid PK)
- client_organization_id (FK → organizations) — the client being analyzed
- assessment_instance_id (FK → assessment_instances) — must be a finalized instance
- service_organization_id (FK → organizations) — the org providing the analysis
- created_by (FK → profiles)
- assigned_to (FK → profiles, nullable)
- title (text, not null)
- status (text, not null, default 'draft')
- created_at, updated_at (timestamptz)

Allowed statuses: draft, inputs_in_progress, ready_for_analysis,
analysis_generated, under_review, approved, finalized.

### 2. analysis_outcome_goals
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- outcome_category (text, not null)
- title (text, not null)
- description (text, nullable)
- priority (text, not null, default 'medium')
- target_population (text, nullable)
- desired_timeframe (text, nullable)
- source_type (text, not null, default 'analyst')
- source_note (text, nullable)
- created_by (FK → profiles)
- created_at, updated_at (timestamptz)

### 3. analysis_outcome_metrics
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- outcome_goal_id (FK → analysis_outcome_goals, nullable, cascade)
- metric_name (text, not null)
- metric_category (text, nullable)
- current_value (text, nullable — supports both numeric and qualitative)
- target_value (text, nullable)
- unit (text, nullable)
- measurement_period (text, nullable)
- population_description (text, nullable)
- data_source (text, nullable)
- data_quality (text, not null, default 'unknown')
- notes (text, nullable)
- created_at, updated_at (timestamptz)

Allowed data_quality: verified, client_reported, estimated, incomplete, unknown.

### 4. analysis_notes
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- note_type (text, not null)
- title (text, nullable)
- content (text, not null)
- visibility (text, not null, default 'internal')
- importance (text, not null, default 'normal')
- created_by (FK → profiles)
- created_at, updated_at (timestamptz)

Allowed note_type: organization_context, analyst_observation,
specific_question, key_consideration, known_constraint, client_priority,
implementation_history, data_limitation, follow_up.

Allowed visibility: internal, organization_team, client_report_candidate.

Allowed importance: low, normal, high, critical.

## Security (RLS)
All tables use the neutral organization model for access control:
- Platform admins: full access to all workspaces
- Service-org members with edit_strategy_analysis: read + write (until finalized)
- Service-org members with approve_strategy_analysis: can approve/finalize
- Service-org members with view_reports: read-only
- Employer-org members: read-only access to workspaces for their own org
- Finalized workspaces are read-only for everyone (no INSERT/UPDATE/DELETE on child tables)

Access is resolved via organization_client_relationships: the user must
have an active membership in the service_organization_id of the workspace,
or be a platform admin, or be an employer member of the client_organization_id.

## Constraints
- CHECK on analysis_workspaces.status for allowed values
- CHECK on analysis_outcome_goals.priority for allowed values
- CHECK on analysis_outcome_metrics.data_quality for allowed values
- CHECK on analysis_notes.note_type, visibility, importance for allowed values
- UNIQUE on (client_organization_id, assessment_instance_id) — one workspace per assessment
- Trigger to prevent edits to finalized workspaces
- Trigger to validate assessment_instance is finalized (submitted or report_ready)
*/

-- ============================================================
-- 1. analysis_workspaces
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_instance_id uuid NOT NULL REFERENCES public.assessment_instances(id) ON DELETE CASCADE,
  service_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_organization_id, assessment_instance_id)
);

ALTER TABLE public.analysis_workspaces
  DROP CONSTRAINT IF EXISTS analysis_workspaces_status_check;
ALTER TABLE public.analysis_workspaces
  ADD CONSTRAINT analysis_workspaces_status_check
  CHECK (status IN ('draft', 'inputs_in_progress', 'ready_for_analysis', 'analysis_generated', 'under_review', 'approved', 'finalized'));

-- ============================================================
-- 2. analysis_outcome_goals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_outcome_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  outcome_category text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  target_population text,
  desired_timeframe text,
  source_type text NOT NULL DEFAULT 'analyst',
  source_note text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_outcome_goals
  DROP CONSTRAINT IF EXISTS analysis_outcome_goals_priority_check;
ALTER TABLE public.analysis_outcome_goals
  ADD CONSTRAINT analysis_outcome_goals_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.analysis_outcome_goals
  DROP CONSTRAINT IF EXISTS analysis_outcome_goals_source_type_check;
ALTER TABLE public.analysis_outcome_goals
  ADD CONSTRAINT analysis_outcome_goals_source_type_check
  CHECK (source_type IN ('analyst', 'client_directed', 'assessment_finding', 'stakeholder_input'));

-- ============================================================
-- 3. analysis_outcome_metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_outcome_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  outcome_goal_id uuid REFERENCES public.analysis_outcome_goals(id) ON DELETE SET NULL,
  metric_name text NOT NULL,
  metric_category text,
  current_value text,
  target_value text,
  unit text,
  measurement_period text,
  population_description text,
  data_source text,
  data_quality text NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_outcome_metrics
  DROP CONSTRAINT IF EXISTS analysis_outcome_metrics_data_quality_check;
ALTER TABLE public.analysis_outcome_metrics
  ADD CONSTRAINT analysis_outcome_metrics_data_quality_check
  CHECK (data_quality IN ('verified', 'client_reported', 'estimated', 'incomplete', 'unknown'));

-- ============================================================
-- 4. analysis_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  note_type text NOT NULL,
  title text,
  content text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal',
  importance text NOT NULL DEFAULT 'normal',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_notes
  DROP CONSTRAINT IF EXISTS analysis_notes_note_type_check;
ALTER TABLE public.analysis_notes
  ADD CONSTRAINT analysis_notes_note_type_check
  CHECK (note_type IN ('organization_context', 'analyst_observation', 'specific_question', 'key_consideration', 'known_constraint', 'client_priority', 'implementation_history', 'data_limitation', 'follow_up'));

ALTER TABLE public.analysis_notes
  DROP CONSTRAINT IF EXISTS analysis_notes_visibility_check;
ALTER TABLE public.analysis_notes
  ADD CONSTRAINT analysis_notes_visibility_check
  CHECK (visibility IN ('internal', 'organization_team', 'client_report_candidate'));

ALTER TABLE public.analysis_notes
  DROP CONSTRAINT IF EXISTS analysis_notes_importance_check;
ALTER TABLE public.analysis_notes
  ADD CONSTRAINT analysis_notes_importance_check
  CHECK (importance IN ('low', 'normal', 'high', 'critical'));

-- ============================================================
-- 5. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_analysis_workspaces_client_org ON public.analysis_workspaces(client_organization_id);
CREATE INDEX IF NOT EXISTS idx_analysis_workspaces_service_org ON public.analysis_workspaces(service_organization_id);
CREATE INDEX IF NOT EXISTS idx_analysis_workspaces_assessment ON public.analysis_workspaces(assessment_instance_id);
CREATE INDEX IF NOT EXISTS idx_analysis_workspaces_status ON public.analysis_workspaces(status);
CREATE INDEX IF NOT EXISTS idx_analysis_outcome_goals_workspace ON public.analysis_outcome_goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analysis_outcome_metrics_workspace ON public.analysis_outcome_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analysis_outcome_metrics_goal ON public.analysis_outcome_metrics(outcome_goal_id);
CREATE INDEX IF NOT EXISTS idx_analysis_notes_workspace ON public.analysis_notes(workspace_id);

-- ============================================================
-- 6. updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS analysis_workspaces_touch ON public.analysis_workspaces;
CREATE TRIGGER analysis_workspaces_touch BEFORE UPDATE ON public.analysis_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS analysis_outcome_goals_touch ON public.analysis_outcome_goals;
CREATE TRIGGER analysis_outcome_goals_touch BEFORE UPDATE ON public.analysis_outcome_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS analysis_outcome_metrics_touch ON public.analysis_outcome_metrics;
CREATE TRIGGER analysis_outcome_metrics_touch BEFORE UPDATE ON public.analysis_outcome_metrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS analysis_notes_touch ON public.analysis_notes;
CREATE TRIGGER analysis_notes_touch BEFORE UPDATE ON public.analysis_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 7. Validation: prevent edits to finalized workspaces
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_workspace_not_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws_status text;
BEGIN
  SELECT status INTO ws_status FROM public.analysis_workspaces WHERE id = NEW.workspace_id;
  IF ws_status IS NULL THEN
    SELECT status INTO ws_status FROM public.analysis_workspaces WHERE id = OLD.workspace_id;
  END IF;
  IF ws_status = 'finalized' THEN
    RAISE EXCEPTION 'Cannot modify inputs for a finalized workspace';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_workspace_not_finalized() FROM PUBLIC;

DROP TRIGGER IF EXISTS block_goal_edit_when_finalized ON public.analysis_outcome_goals;
CREATE TRIGGER block_goal_edit_when_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.analysis_outcome_goals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_not_finalized();

DROP TRIGGER IF EXISTS block_metric_edit_when_finalized ON public.analysis_outcome_metrics;
CREATE TRIGGER block_metric_edit_when_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.analysis_outcome_metrics
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_not_finalized();

DROP TRIGGER IF EXISTS block_note_edit_when_finalized ON public.analysis_notes;
CREATE TRIGGER block_note_edit_when_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.analysis_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_not_finalized();

-- Also prevent workspace status changes after finalized
CREATE OR REPLACE FUNCTION public.enforce_workspace_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'finalized' AND NEW.status != 'finalized' THEN
    RAISE EXCEPTION 'Cannot change status of a finalized workspace';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_workspace_status_transition() FROM PUBLIC;

DROP TRIGGER IF EXISTS block_workspace_status_change ON public.analysis_workspaces;
CREATE TRIGGER block_workspace_status_change
  BEFORE UPDATE ON public.analysis_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_status_transition();

-- ============================================================
-- 8. RLS: analysis_workspaces
-- ============================================================
ALTER TABLE public.analysis_workspaces ENABLE ROW LEVEL SECURITY;

-- Helper: user has access to this workspace
CREATE OR REPLACE FUNCTION public.can_access_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.analysis_workspaces aw
    WHERE aw.id = p_workspace_id
      AND (
        public.has_platform_admin()
        OR aw.service_organization_id IN (
          SELECT om.organization_id FROM public.organization_memberships om
          WHERE om.profile_id = auth.uid() AND om.status = 'active'
        )
        OR aw.client_organization_id IN (
          SELECT om.organization_id FROM public.organization_memberships om
          WHERE om.profile_id = auth.uid() AND om.status = 'active'
        )
        OR aw.client_organization_id IN (SELECT public.resolve_accessible_client_orgs())
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_workspace(uuid) TO authenticated;

DROP POLICY IF EXISTS "select_workspaces_accessible" ON analysis_workspaces;
CREATE POLICY "select_workspaces_accessible" ON analysis_workspaces
  FOR SELECT TO authenticated
  USING (
    public.has_platform_admin()
    OR service_organization_id IN (
      SELECT om.organization_id FROM public.organization_memberships om
      WHERE om.profile_id = auth.uid() AND om.status = 'active'
    )
    OR client_organization_id IN (
      SELECT om.organization_id FROM public.organization_memberships om
      WHERE om.profile_id = auth.uid() AND om.status = 'active'
    )
    OR client_organization_id IN (SELECT public.resolve_accessible_client_orgs())
  );

DROP POLICY IF EXISTS "insert_workspaces_edit_cap" ON analysis_workspaces;
CREATE POLICY "insert_workspaces_edit_cap" ON analysis_workspaces
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND (
      public.has_platform_admin()
      OR service_organization_id IN (
        SELECT om.organization_id FROM public.organization_memberships om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "update_workspaces_edit_cap" ON analysis_workspaces;
CREATE POLICY "update_workspaces_edit_cap" ON analysis_workspaces
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(id)
  );

DROP POLICY IF EXISTS "delete_workspaces_admin" ON analysis_workspaces;
CREATE POLICY "delete_workspaces_admin" ON analysis_workspaces
  FOR DELETE TO authenticated
  USING (public.has_platform_admin());

-- ============================================================
-- 9. RLS: analysis_outcome_goals
-- ============================================================
ALTER TABLE public.analysis_outcome_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_goals_accessible" ON analysis_outcome_goals;
CREATE POLICY "select_goals_accessible" ON analysis_outcome_goals
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "insert_goals_edit_cap" ON analysis_outcome_goals;
CREATE POLICY "insert_goals_edit_cap" ON analysis_outcome_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "update_goals_edit_cap" ON analysis_outcome_goals;
CREATE POLICY "update_goals_edit_cap" ON analysis_outcome_goals
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "delete_goals_edit_cap" ON analysis_outcome_goals;
CREATE POLICY "delete_goals_edit_cap" ON analysis_outcome_goals
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

-- ============================================================
-- 10. RLS: analysis_outcome_metrics
-- ============================================================
ALTER TABLE public.analysis_outcome_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_metrics_accessible" ON analysis_outcome_metrics;
CREATE POLICY "select_metrics_accessible" ON analysis_outcome_metrics
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "insert_metrics_edit_cap" ON analysis_outcome_metrics;
CREATE POLICY "insert_metrics_edit_cap" ON analysis_outcome_metrics
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "update_metrics_edit_cap" ON analysis_outcome_metrics;
CREATE POLICY "update_metrics_edit_cap" ON analysis_outcome_metrics
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "delete_metrics_edit_cap" ON analysis_outcome_metrics;
CREATE POLICY "delete_metrics_edit_cap" ON analysis_outcome_metrics
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

-- ============================================================
-- 11. RLS: analysis_notes
-- ============================================================
ALTER TABLE public.analysis_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_notes_accessible" ON analysis_notes;
CREATE POLICY "select_notes_accessible" ON analysis_notes
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "insert_notes_edit_cap" ON analysis_notes;
CREATE POLICY "insert_notes_edit_cap" ON analysis_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "update_notes_edit_cap" ON analysis_notes;
CREATE POLICY "update_notes_edit_cap" ON analysis_notes
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "delete_notes_edit_cap" ON analysis_notes;
CREATE POLICY "delete_notes_edit_cap" ON analysis_notes
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

-- ============================================================
-- 12. RPC: finalize_workspace
-- Approves and finalizes a workspace. Requires approve_strategy_analysis.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_capability('approve_strategy_analysis') THEN
    RAISE EXCEPTION 'You do not have permission to finalize workspaces';
  END IF;
  IF NOT public.can_access_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace not found or access denied';
  END IF;
  UPDATE public.analysis_workspaces
  SET status = 'finalized'
  WHERE id = p_workspace_id AND status IN ('approved', 'under_review');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace must be in approved or under_review status to finalize';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_workspace(uuid) TO authenticated;

-- ============================================================
-- 13. RPC: approve_workspace
-- Moves workspace from under_review to approved. Requires approve_strategy_analysis.
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_capability('approve_strategy_analysis') THEN
    RAISE EXCEPTION 'You do not have permission to approve workspaces';
  END IF;
  IF NOT public.can_access_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace not found or access denied';
  END IF;
  UPDATE public.analysis_workspaces
  SET status = 'approved'
  WHERE id = p_workspace_id AND status IN ('under_review', 'analysis_generated');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace must be in under_review or analysis_generated status to approve';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_workspace(uuid) TO authenticated;
