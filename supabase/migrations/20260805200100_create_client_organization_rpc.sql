/*
# create_client_organization RPC — creates an organization and immediately
# links it to the caller's service organization via organization_client_relationships,
# so the neutral-model access path works right away instead of depending on the
# fragile broker_id + role='broker' legacy fallback.
*/

CREATE OR REPLACE FUNCTION public.create_client_organization(
  p_organization_name text,
  p_organization_alias text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_employee_count_range text DEFAULT NULL,
  p_employee_count integer DEFAULT NULL,
  p_number_of_locations integer DEFAULT NULL,
  p_funding_type text DEFAULT NULL,
  p_renewal_month integer DEFAULT NULL,
  p_client_contact_name text DEFAULT NULL,
  p_client_contact_email text DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_service_org_id uuid;
  v_new_org public.organizations;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_capability('manage_clients') THEN
    RAISE EXCEPTION 'Not authorized: manage_clients capability required';
  END IF;

  INSERT INTO public.organizations (
    broker_id, organization_name, organization_alias, industry,
    employee_count_range, employee_count, number_of_locations,
    funding_type, renewal_month, client_contact_name, client_contact_email,
    organization_type
  ) VALUES (
    v_caller_id, p_organization_name, p_organization_alias, p_industry,
    p_employee_count_range, p_employee_count, p_number_of_locations,
    p_funding_type, p_renewal_month, p_client_contact_name, p_client_contact_email,
    'employer'
  )
  RETURNING * INTO v_new_org;

  v_service_org_id := public.resolve_service_organization_id();

  IF v_service_org_id IS NOT NULL THEN
    INSERT INTO public.organization_client_relationships (
      service_organization_id, client_organization_id, relationship_type, status
    ) VALUES (
      v_service_org_id, v_new_org.id, 'advisor', 'active'
    )
    ON CONFLICT (service_organization_id, client_organization_id) DO NOTHING;
  END IF;

  RETURN v_new_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_organization(
  text, text, text, text, integer, integer, text, integer, text, text
) TO authenticated;