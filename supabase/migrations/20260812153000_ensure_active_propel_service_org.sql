/*
# Ensure an active Propel service organization exists

The CSM membership repair requires an active organization with
organization_type='propel'. Production had only an archived Propel organization,
so existing and future Propel Client Services users could not receive an active
membership or the manage_clients capability.
*/

DO $$
DECLARE
  v_org_id uuid;
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE organization_type = 'propel'
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_owner_id
    FROM public.profiles
    WHERE role = 'superadmin'
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create Propel service organization: no active superadmin profile found';
    END IF;

    INSERT INTO public.organizations (
      broker_id,
      organization_name,
      organization_type,
      status
    )
    VALUES (
      v_owner_id,
      'Propel Client Services',
      'propel',
      'active'
    )
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id,
    profile_id,
    role,
    status
  )
  SELECT
    v_org_id,
    p.id,
    'client_manager',
    'active'
  FROM public.profiles p
  WHERE p.role = 'propel_csm'
    AND p.status NOT IN ('suspended', 'archived')
  ON CONFLICT (profile_id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = now();
END $$;
