/*
# Harden auto_create_workspace_and_snapshot RPC

## Summary
Replaces the auto_create_workspace_and_snapshot function with a hardened
version that derives the caller identity from auth.uid() instead of trusting
a client-supplied creator ID, verifies the caller has active access to the
assessment's client organization, requires the generate_ai_analysis
capability, and prevents cross-organization access.

## Security Controls
1. Derives authenticated user from auth.uid() — ignores p_created_by
2. Verifies user has active membership in a service organization
3. Verifies user has generate_ai_analysis capability
4. Verifies the assessment instance belongs to a client organization the
   caller can access (via resolve_accessible_client_orgs)
5. Requires the assessment to be submitted with a non-null overall_score
6. Cannot create workspaces or snapshots for another organization
7. Cannot be called by an anonymous assessment respondent (EXECUTE only TO authenticated)
8. Uses a fixed search_path (public, pg_temp)
9. SECURITY DEFINER so it can insert into analysis_workspaces and call
   create_analysis_snapshot

## Notes
- Does NOT delete or modify existing workspaces, snapshots, or generations.
- The p_created_by parameter is kept for backward compatibility but ignored;
  auth.uid() is used for all authorization and audit fields.
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
  SELECT COALESCE(array_agg(org_id), ARRAY[]::uuid[]) INTO v_accessible_org_ids
  FROM public.resolve_accessible_client_orgs();

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

-- Revoke from anon, grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) TO authenticated;
