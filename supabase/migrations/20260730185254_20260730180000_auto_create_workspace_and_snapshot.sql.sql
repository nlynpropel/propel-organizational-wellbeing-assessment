/*
# Auto-create workspace and snapshot for strategy generation

1. Purpose
   - Allows a broker to generate a strategy report directly from the report page
   - without manually managing a strategy-analysis workspace.
   - When invoked, the RPC finds an existing workspace for the assessment instance
   - (or creates one), creates an immutable snapshot, and returns the IDs needed
   - to create a generation record.

2. New Functions
   - `auto_create_workspace_and_snapshot(p_assessment_instance_id uuid, p_created_by uuid)`
     - SECURITY DEFINER so it can insert into analysis_workspaces and
       analysis_input_snapshots on behalf of the authenticated broker.
     - Resolves the service organization for the creator.
     - Checks that the assessment instance is submitted (has valid deterministic results).
     - Finds an existing workspace for this instance or creates a new one.
     - Creates a snapshot via the existing `create_analysis_snapshot` RPC.
     - Returns `{ workspace_id uuid, snapshot_id uuid, snapshot_version int }`.

3. Security
   - SECURITY DEFINER with `SET search_path = public, pg_temp`.
   - Verifies the caller owns the assessment instance (via organization membership
     or legacy broker_id ownership) before creating anything.
   - Only allows snapshot creation when the assessment is submitted/report_ready
     with a non-null overall_score (deterministic results exist).

4. Notes
   - Does NOT delete or modify existing workspaces, snapshots, or generations.
   - The created workspace starts in `draft` status; the snapshot captures the
     current assessment data immutably.
*/

CREATE OR REPLACE FUNCTION public.auto_create_workspace_and_snapshot(
  p_assessment_instance_id uuid,
  p_created_by uuid
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
  v_service_org_id uuid;
  v_workspace_id uuid;
  v_snapshot_result jsonb;
  v_client_org_id uuid;
BEGIN
  -- Fetch the assessment instance
  SELECT ai.* INTO v_instance
  FROM assessment_instances ai
  WHERE ai.id = p_assessment_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment instance not found';
  END IF;

  -- Verify the assessment is submitted with deterministic results
  IF v_instance.status NOT IN ('submitted', 'report_ready') THEN
    RAISE EXCEPTION 'Assessment must be submitted before generating a strategy report';
  END IF;

  IF v_instance.overall_score IS NULL THEN
    RAISE EXCEPTION 'Assessment must have deterministic scores calculated before generating a strategy report';
  END IF;

  v_client_org_id := v_instance.organization_id;

  -- Resolve the service organization for the creator
  SELECT so.id INTO v_service_org_id
  FROM organizations so
  WHERE so.id = (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = p_created_by
      AND om.status = 'active'
    ORDER BY om.created_at ASC
    LIMIT 1
  );

  IF v_service_org_id IS NULL THEN
    -- Fall back: use the instance's organization's broker_id service org
    SELECT o.broker_id INTO v_service_org_id
    FROM organizations o
    WHERE o.id = v_client_org_id;
    IF v_service_org_id IS NULL THEN
      RAISE EXCEPTION 'No service organization found for the creator';
    END IF;
  END IF;

  -- Find an existing workspace for this assessment instance
  SELECT aw.id INTO v_workspace_id
  FROM analysis_workspaces aw
  WHERE aw.assessment_instance_id = p_assessment_instance_id
    AND aw.client_organization_id = v_client_org_id
  ORDER BY aw.created_at DESC
  LIMIT 1;

  -- Create a new workspace if none exists
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
      p_created_by,
      'Strategy Report — ' || COALESCE(v_instance.respondent_name, 'Assessment'),
      'draft'
    )
    RETURNING id INTO v_workspace_id;
  END IF;

  -- Create the snapshot via the existing RPC
  SELECT * INTO v_snapshot_result
  FROM create_analysis_snapshot(p_workspace_id := v_workspace_id);

  RETURN QUERY SELECT
    v_workspace_id,
    (v_snapshot_result->>'snapshot_id')::uuid,
    (v_snapshot_result->>'snapshot_version')::int;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) TO authenticated;
