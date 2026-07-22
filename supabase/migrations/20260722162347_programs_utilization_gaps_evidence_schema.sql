/*
# Programs, Utilization, Resource Gaps, and Evidence Sources

## Purpose
Extend the Strategy Analysis workspace with client program inventory,
program utilization records, resource gaps, and evidence sources.

## New Tables

### 1. client_programs
Belongs to the client organization — reusable across workspaces.
- id (uuid PK)
- client_organization_id (FK → organizations, cascade)
- program_name (text, not null)
- provider_name (text, nullable)
- program_category (text, not null)
- description (text, nullable)
- target_population (text, nullable)
- eligibility_summary (text, nullable)
- access_method (text, nullable)
- communication_channels (text, nullable)
- incentive_connected (boolean, default false)
- status (text, not null, default 'active')
- start_date (date, nullable)
- end_date (date, nullable)
- source_type (text, not null, default 'client_reported')
- source_note (text, nullable)
- created_at, updated_at (timestamptz)

Allowed status: active, paused, discontinued, planned.
Allowed source_type: client_reported, analyst_entered, verified, estimated.

### 2. program_utilization_records
Belongs to a workspace — links to a client_program.
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- client_program_id (FK → client_programs, cascade)
- measurement_start (date, nullable)
- measurement_end (date, nullable)
- eligible_population (integer, nullable)
- registered_count (integer, nullable)
- active_user_count (integer, nullable)
- completion_count (integer, nullable)
- utilization_rate (numeric(5,2), nullable)
- repeat_engagement_rate (numeric(5,2), nullable)
- benchmark_value (text, nullable)
- benchmark_source (text, nullable)
- utilization_status (text, not null, default 'not_measured')
- data_quality (text, not null, default 'unknown')
- notes (text, nullable)
- created_at, updated_at (timestamptz)

Allowed utilization_status: not_measured, low, moderate, high, unknown.
Allowed data_quality: verified, client_reported, estimated, incomplete, unknown.

### 3. analysis_resource_gaps
Belongs to a workspace.
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- gap_category (text, not null)
- title (text, not null)
- description (text, not null)
- affected_population (text, nullable)
- evidence_source (text, not null, default 'manual')
- severity (text, not null, default 'medium')
- confidence (text, not null, default 'medium')
- status (text, not null, default 'open')
- user_confirmed (boolean, not null, default false)
- created_by (FK → profiles, restrict)
- created_at, updated_at (timestamptz)

Allowed gap_category: program_gap, population_gap, access_gap, resource_gap, data_gap, other.
Allowed evidence_source: manual, utilization_data, assessment_finding, client_input, benchmark.
Allowed severity: low, medium, high, critical.
Allowed confidence: low, medium, high.
Allowed status: open, confirmed, addressed, dismissed.

### 4. analysis_evidence_sources
Belongs to a workspace.
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- source_type (text, not null)
- source_name (text, not null)
- source_date (date, nullable)
- description (text, nullable)
- file_reference (text, nullable)
- verification_status (text, not null, default 'unverified')
- entered_by (FK → profiles, restrict)
- created_at (timestamptz)

Allowed source_type: assessment_data, utilization_report, client_document,
benchmark_data, stakeholder_interview, third_party_report, other.
Allowed verification_status: unverified, verified, disputed.

## Security (RLS)
- client_programs: accessible to users who can access the client org
  (platform admin, service-org members, employer members of the org).
  Edit requires edit_strategy_analysis. Employer users: read-only.
- program_utilization_records, analysis_resource_gaps, analysis_evidence_sources:
  accessible via can_access_workspace(). Edit requires edit_strategy_analysis.
  All three are blocked when workspace is finalized (trigger).
- client_programs is NOT workspace-scoped, so it does not get the
  finalized-workspace trigger. It has its own RLS based on org access.

## Constraints
- CHECK constraints on all enum columns.
- Triggers to prevent edits to finalized workspace child tables
  (program_utilization_records, analysis_resource_gaps, analysis_evidence_sources).
- Indexes on frequently queried columns.
*/

-- ============================================================
-- 1. client_programs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_name text NOT NULL,
  provider_name text,
  program_category text NOT NULL,
  description text,
  target_population text,
  eligibility_summary text,
  access_method text,
  communication_channels text,
  incentive_connected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  source_type text NOT NULL DEFAULT 'client_reported',
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_programs
  DROP CONSTRAINT IF EXISTS client_programs_status_check;
ALTER TABLE public.client_programs
  ADD CONSTRAINT client_programs_status_check
  CHECK (status IN ('active', 'paused', 'discontinued', 'planned'));

ALTER TABLE public.client_programs
  DROP CONSTRAINT IF EXISTS client_programs_source_type_check;
ALTER TABLE public.client_programs
  ADD CONSTRAINT client_programs_source_type_check
  CHECK (source_type IN ('client_reported', 'analyst_entered', 'verified', 'estimated'));

CREATE INDEX IF NOT EXISTS idx_client_programs_org ON public.client_programs(client_organization_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_status ON public.client_programs(status);

DROP TRIGGER IF EXISTS client_programs_touch ON public.client_programs;
CREATE TRIGGER client_programs_touch BEFORE UPDATE ON public.client_programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2. program_utilization_records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.program_utilization_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  client_program_id uuid NOT NULL REFERENCES public.client_programs(id) ON DELETE CASCADE,
  measurement_start date,
  measurement_end date,
  eligible_population integer,
  registered_count integer,
  active_user_count integer,
  completion_count integer,
  utilization_rate numeric(5,2),
  repeat_engagement_rate numeric(5,2),
  benchmark_value text,
  benchmark_source text,
  utilization_status text NOT NULL DEFAULT 'not_measured',
  data_quality text NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.program_utilization_records
  DROP CONSTRAINT IF EXISTS program_utilization_records_status_check;
ALTER TABLE public.program_utilization_records
  ADD CONSTRAINT program_utilization_records_status_check
  CHECK (utilization_status IN ('not_measured', 'low', 'moderate', 'high', 'unknown'));

ALTER TABLE public.program_utilization_records
  DROP CONSTRAINT IF EXISTS program_utilization_records_data_quality_check;
ALTER TABLE public.program_utilization_records
  ADD CONSTRAINT program_utilization_records_data_quality_check
  CHECK (data_quality IN ('verified', 'client_reported', 'estimated', 'incomplete', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_program_utilization_workspace ON public.program_utilization_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_program_utilization_program ON public.program_utilization_records(client_program_id);

DROP TRIGGER IF EXISTS program_utilization_touch ON public.program_utilization_records;
CREATE TRIGGER program_utilization_touch BEFORE UPDATE ON public.program_utilization_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Block edits when workspace finalized
DROP TRIGGER IF EXISTS block_utilization_edit_when_finalized ON public.program_utilization_records;
CREATE TRIGGER block_utilization_edit_when_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.program_utilization_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_not_finalized();

-- ============================================================
-- 3. analysis_resource_gaps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_resource_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  gap_category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  affected_population text,
  evidence_source text NOT NULL DEFAULT 'manual',
  severity text NOT NULL DEFAULT 'medium',
  confidence text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  user_confirmed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_resource_gaps
  DROP CONSTRAINT IF EXISTS analysis_resource_gaps_gap_category_check;
ALTER TABLE public.analysis_resource_gaps
  ADD CONSTRAINT analysis_resource_gaps_gap_category_check
  CHECK (gap_category IN ('program_gap', 'population_gap', 'access_gap', 'resource_gap', 'data_gap', 'other'));

ALTER TABLE public.analysis_resource_gaps
  DROP CONSTRAINT IF EXISTS analysis_resource_gaps_evidence_source_check;
ALTER TABLE public.analysis_resource_gaps
  ADD CONSTRAINT analysis_resource_gaps_evidence_source_check
  CHECK (evidence_source IN ('manual', 'utilization_data', 'assessment_finding', 'client_input', 'benchmark'));

ALTER TABLE public.analysis_resource_gaps
  DROP CONSTRAINT IF EXISTS analysis_resource_gaps_severity_check;
ALTER TABLE public.analysis_resource_gaps
  ADD CONSTRAINT analysis_resource_gaps_severity_check
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.analysis_resource_gaps
  DROP CONSTRAINT IF EXISTS analysis_resource_gaps_confidence_check;
ALTER TABLE public.analysis_resource_gaps
  ADD CONSTRAINT analysis_resource_gaps_confidence_check
  CHECK (confidence IN ('low', 'medium', 'high'));

ALTER TABLE public.analysis_resource_gaps
  DROP CONSTRAINT IF EXISTS analysis_resource_gaps_status_check;
ALTER TABLE public.analysis_resource_gaps
  ADD CONSTRAINT analysis_resource_gaps_status_check
  CHECK (status IN ('open', 'confirmed', 'addressed', 'dismissed'));

CREATE INDEX IF NOT EXISTS idx_resource_gaps_workspace ON public.analysis_resource_gaps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_resource_gaps_status ON public.analysis_resource_gaps(status);

DROP TRIGGER IF EXISTS resource_gaps_touch ON public.analysis_resource_gaps;
CREATE TRIGGER resource_gaps_touch BEFORE UPDATE ON public.analysis_resource_gaps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS block_gap_edit_when_finalized ON public.analysis_resource_gaps;
CREATE TRIGGER block_gap_edit_when_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.analysis_resource_gaps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_not_finalized();

-- ============================================================
-- 4. analysis_evidence_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_evidence_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  source_date date,
  description text,
  file_reference text,
  verification_status text NOT NULL DEFAULT 'unverified',
  entered_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_evidence_sources
  DROP CONSTRAINT IF EXISTS analysis_evidence_sources_source_type_check;
ALTER TABLE public.analysis_evidence_sources
  ADD CONSTRAINT analysis_evidence_sources_source_type_check
  CHECK (source_type IN ('assessment_data', 'utilization_report', 'client_document', 'benchmark_data', 'stakeholder_interview', 'third_party_report', 'other'));

ALTER TABLE public.analysis_evidence_sources
  DROP CONSTRAINT IF EXISTS analysis_evidence_sources_verification_status_check;
ALTER TABLE public.analysis_evidence_sources
  ADD CONSTRAINT analysis_evidence_sources_verification_status_check
  CHECK (verification_status IN ('unverified', 'verified', 'disputed'));

CREATE INDEX IF NOT EXISTS idx_evidence_sources_workspace ON public.analysis_evidence_sources(workspace_id);

-- Evidence sources have no updated_at, so no touch trigger.
-- Block edits when workspace finalized.
DROP TRIGGER IF EXISTS block_evidence_edit_when_finalized ON public.analysis_evidence_sources;
CREATE TRIGGER block_evidence_edit_when_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.analysis_evidence_sources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_not_finalized();

-- ============================================================
-- 5. RLS: client_programs
-- ============================================================
ALTER TABLE public.client_programs ENABLE ROW LEVEL SECURITY;

-- Helper: user can access client org (for programs)
CREATE OR REPLACE FUNCTION public.can_access_client_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 WHERE
      public.has_platform_admin()
      OR p_org_id IN (
        SELECT om.organization_id FROM public.organization_memberships om
        WHERE om.profile_id = auth.uid() AND om.status = 'active'
      )
      OR p_org_id IN (SELECT public.resolve_accessible_client_orgs())
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_client_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_client_org(uuid) TO authenticated;

DROP POLICY IF EXISTS "select_client_programs_accessible" ON client_programs;
CREATE POLICY "select_client_programs_accessible" ON client_programs
  FOR SELECT TO authenticated
  USING (public.can_access_client_org(client_organization_id));

DROP POLICY IF EXISTS "insert_client_programs_edit_cap" ON client_programs;
CREATE POLICY "insert_client_programs_edit_cap" ON client_programs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_client_org(client_organization_id)
  );

DROP POLICY IF EXISTS "update_client_programs_edit_cap" ON client_programs;
CREATE POLICY "update_client_programs_edit_cap" ON client_programs
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_client_org(client_organization_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_client_org(client_organization_id)
  );

DROP POLICY IF EXISTS "delete_client_programs_edit_cap" ON client_programs;
CREATE POLICY "delete_client_programs_edit_cap" ON client_programs
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_client_org(client_organization_id)
  );

-- ============================================================
-- 6. RLS: program_utilization_records
-- ============================================================
ALTER TABLE public.program_utilization_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_utilization_accessible" ON program_utilization_records;
CREATE POLICY "select_utilization_accessible" ON program_utilization_records
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "insert_utilization_edit_cap" ON program_utilization_records;
CREATE POLICY "insert_utilization_edit_cap" ON program_utilization_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "update_utilization_edit_cap" ON program_utilization_records;
CREATE POLICY "update_utilization_edit_cap" ON program_utilization_records
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "delete_utilization_edit_cap" ON program_utilization_records;
CREATE POLICY "delete_utilization_edit_cap" ON program_utilization_records
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

-- ============================================================
-- 7. RLS: analysis_resource_gaps
-- ============================================================
ALTER TABLE public.analysis_resource_gaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gaps_accessible" ON analysis_resource_gaps;
CREATE POLICY "select_gaps_accessible" ON analysis_resource_gaps
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "insert_gaps_edit_cap" ON analysis_resource_gaps;
CREATE POLICY "insert_gaps_edit_cap" ON analysis_resource_gaps
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "update_gaps_edit_cap" ON analysis_resource_gaps;
CREATE POLICY "update_gaps_edit_cap" ON analysis_resource_gaps
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "delete_gaps_edit_cap" ON analysis_resource_gaps;
CREATE POLICY "delete_gaps_edit_cap" ON analysis_resource_gaps
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

-- ============================================================
-- 8. RLS: analysis_evidence_sources
-- ============================================================
ALTER TABLE public.analysis_evidence_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_evidence_accessible" ON analysis_evidence_sources;
CREATE POLICY "select_evidence_accessible" ON analysis_evidence_sources
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "insert_evidence_edit_cap" ON analysis_evidence_sources;
CREATE POLICY "insert_evidence_edit_cap" ON analysis_evidence_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "update_evidence_edit_cap" ON analysis_evidence_sources;
CREATE POLICY "update_evidence_edit_cap" ON analysis_evidence_sources
  FOR UPDATE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "delete_evidence_edit_cap" ON analysis_evidence_sources;
CREATE POLICY "delete_evidence_edit_cap" ON analysis_evidence_sources
  FOR DELETE TO authenticated
  USING (
    public.has_capability('edit_strategy_analysis')
    AND public.can_access_workspace(workspace_id)
  );
