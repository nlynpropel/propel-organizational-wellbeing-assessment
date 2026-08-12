/*
# Fix Propel Client Services membership on self-service signup

Self-service users from @propelwellness.com are assigned the canonical
`propel_csm` profile role, but the current handle_new_user() function does not
create an organization_memberships row for them. Both database authorization
(has_capability) and the frontend capability loader derive permissions from
active organization memberships, so these users cannot create clients.

This migration:
1. Keeps @propelwellness.com -> propel_csm profile-role assignment.
2. Adds Propel CSM users to the active Propel organization as `client_manager`.
   That existing membership role includes manage_clients, send_assessments,
   and view_reports without granting platform-admin access.
3. Repairs existing propel_csm profiles that are missing or have an inactive
   organization membership.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_approved_domain RECORD;
  v_role text := 'broker';
  v_org_id uuid;
  v_is_admin_invite boolean;
BEGIN
  -- Check if this is an admin invitation (invited_by in metadata).
  v_is_admin_invite := (NEW.raw_user_meta_data ? 'invited_by');

  IF v_is_admin_invite THEN
    -- Admin invitations: admin_invite_user already created the profile with
    -- the correct role. Just ensure the profile exists (idempotent).
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Self-service registration: determine role from email domain.
  v_domain := lower(split_part(NEW.email, '@', 2));

  SELECT * INTO v_approved_domain
  FROM public.approved_domains
  WHERE lower(domain) = v_domain
  LIMIT 1;

  IF v_approved_domain.domain IS NULL THEN
    -- Domain enforcement runs before this trigger; retain broker as a safe
    -- fallback if this function is ever invoked without a mapped domain.
    v_role := 'broker';
  ELSIF v_domain = 'propelwellness.com' THEN
    v_role := 'propel_csm';
  ELSE
    v_role := 'broker';
  END IF;

  -- Create the profile with the role and names supplied at signup.
  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NULL),
    v_role,
    'setup_incomplete'
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'propel_csm' THEN
    -- Internal CSM users belong to the shared Propel service organization.
    -- Use client_manager rather than platform_admin so they receive client
    -- management capabilities without superadmin/admin-tool permissions.
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE organization_type = 'propel'
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.organization_memberships (
        organization_id, profile_id, role, status
      )
      VALUES (v_org_id, NEW.id, 'client_manager', 'active')
      ON CONFLICT (profile_id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          updated_at = now();
    END IF;

  ELSIF v_role = 'broker'
    AND v_approved_domain.domain IS NOT NULL
    AND v_domain != 'propelwellness.com' THEN
    -- Existing external-broker behavior: find or create the mapped org.
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE organization_name = COALESCE(v_approved_domain.organization_name, v_domain)
      AND archived_at IS NULL
    LIMIT 1;

    IF v_org_id IS NULL THEN
      INSERT INTO public.organizations (organization_name, organization_type, status)
      VALUES (COALESCE(v_approved_domain.organization_name, v_domain), 'broker', 'active')
      RETURNING id INTO v_org_id;
    END IF;

    INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
    VALUES (v_org_id, NEW.id, 'broker', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the capability relied on by create_client_organization() remains
-- attached to the selected CSM membership role.
INSERT INTO public.organization_role_capabilities (role, capability)
VALUES ('client_manager', 'manage_clients')
ON CONFLICT (role, capability) DO NOTHING;

-- Repair existing Propel Client Services accounts. The unique profile_id index
-- means each user has one primary organization membership in the current model.
WITH propel_org AS (
  SELECT id
  FROM public.organizations
  WHERE organization_type = 'propel'
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.organization_memberships (
  organization_id, profile_id, role, status
)
SELECT po.id, p.id, 'client_manager', 'active'
FROM public.profiles p
CROSS JOIN propel_org po
WHERE p.role = 'propel_csm'
  AND p.status NOT IN ('suspended', 'archived')
ON CONFLICT (profile_id) DO UPDATE
SET organization_id = EXCLUDED.organization_id,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = now();
