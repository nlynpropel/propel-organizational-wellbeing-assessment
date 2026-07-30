/*
# Fix org_id column reference in auto_create_workspace_and_snapshot

## Root Cause
resolve_accessible_client_orgs() RETURNS SETOF uuid — a scalar set of UUIDs
with no named column. The RPC referenced `array_agg(org_id)` which fails with
"column org_id does not exist" because there is no column named org_id in
the function's result set.

## Fix
Replace `array_agg(org_id)` with `ARRAY(SELECT ...)` which correctly collects
the scalar UUIDs returned by the set-returning function.

## Security
All existing security controls are preserved:
- auth.uid() identity derivation
- generate_ai_analysis capability requirement
- cross-organization access check (v_client_org_id = ANY(v_accessible_org_ids))
- submitted-assessment requirement
- deterministic-results requirement (non-null overall_score)
- fixed search_path = public, pg_temp
- EXECUTE granted only to authenticated
- SECURITY DEFINER
*/

CREATE OR REPLACE FUNCTION public.auto_create_workspace_and_snapshot(
  p_assessment_instance_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (
  workspace_id uuid,
  snapshot_id uuid,
  snapshot_version int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_instance record;
  v_caller_id uuid;
  v_service_org_id uuid;
  v_workspace_id uuid;
  v_snapshot_result jsonb;
  v_client_org_id uuid;
  v_accessible_org_ids uuid[];
BEGIN
  -- 1. Derive caller from auth.uid() — never trust client-supplied ID
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch the assessment instance
  SELECT ai.* INTO v_instance
  FROM assessment_instances ai
  WHERE ai.id = p_assessment_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment instance not found';
  END IF;

  v_client_org_id := v_instance.organization_id;

  -- 3. Verify the assessment is submitted with deterministic results
  IF v_instance.status NOT IN ('submitted', 'report_ready') THEN
    RAISE EXCEPTION 'Assessment must be submitted before generating a strategy report';
  END IF;

  IF v_instance.overall_score IS NULL THEN
    RAISE EXCEPTION 'Assessment must have deterministic scores calculated before generating a strategy report';
  END IF;

  -- 4. Verify the caller has active access to this client organization
  -- resolve_accessible_client_orgs() RETURNS SETOF uuid (scalar, no column name)
  v_accessible_org_ids := ARRAY(SELECT public.resolve_accessible_client_orgs());

  IF NOT v_client_org_id = ANY(v_accessible_org_ids) THEN
    RAISE EXCEPTION 'Not authorized: assessment belongs to an organization you cannot access';
  END IF;

  -- 5. Verify the caller has generate_ai_analysis capability
  IF NOT public.has_capability('generate_ai_analysis') THEN
    RAISE EXCEPTION 'Not authorized: generate_ai_analysis capability required';
  END IF;

  -- 6. Resolve the service organization for the caller
  SELECT so.id INTO v_service_org_id
  FROM organizations so
  WHERE so.id = (
    SELECT om.organization_id
    FROM organization_memberships om
    WHERE om.profile_id = v_caller_id
      AND om.status = 'active'
    ORDER BY om.created_at ASC
    LIMIT 1
  );

  IF v_service_org_id IS NULL THEN
    RAISE EXCEPTION 'No service organization found for your account';
  END IF;

  -- 7. Find an existing workspace for this assessment instance (same client org)
  SELECT aw.id INTO v_workspace_id
  FROM analysis_workspaces aw
  WHERE aw.assessment_instance_id = p_assessment_instance_id
    AND aw.client_organization_id = v_client_org_id
  ORDER BY aw.created_at DESC
  LIMIT 1;

  -- 8. Create a new workspace if none exists
  IF v_workspace_id IS NULL THEN
    INSERT INTO analysis_workspaces (
      client_organization_id,
      assessment_instance_id,
      service_organization_id,
      created_by,
      title,
      status
    ) VALUES (
      v_client_org_id,
      p_assessment_instance_id,
      v_service_org_id,
      v_caller_id,
      'Strategy Report — ' || COALESCE(v_instance.respondent_name, 'Assessment'),
      'draft'
    )
    RETURNING id INTO v_workspace_id;
  END IF;

  -- 9. Create the snapshot via the existing RPC
  SELECT * INTO v_snapshot_result
  FROM create_analysis_snapshot(p_workspace_id := v_workspace_id);

  RETURN QUERY SELECT
    v_workspace_id,
    (v_snapshot_result->>'snapshot_id')::uuid,
    (v_snapshot_result->>'snapshot_version')::int;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) TO authenticated;
