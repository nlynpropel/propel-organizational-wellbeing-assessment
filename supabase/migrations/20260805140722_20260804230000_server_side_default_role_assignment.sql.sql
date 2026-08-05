/*
# Server-side default role assignment on self-service registration

Updates handle_new_user() to assign roles based on email domain:
- @propelwellness.com → propel_csm (Propel Client Services)
- approved external broker domain → broker + mapped organization membership
- unapproved domain → already rejected by enforce_approved_domain_on_signup trigger

Never grants propel_sales or superadmin automatically.

Profile and membership creation are idempotent (ON CONFLICT DO NOTHING).

1. Update handle_new_user() to determine role from approved_domains
2. For external broker domains, auto-create organization from the domain's
   organization_name and add the user as a broker member.
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
  -- Check if this is an admin invitation (invited_by in metadata)
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

  -- Self-service registration: determine role from email domain
  v_domain := lower(split_part(NEW.email, '@', 2));

  SELECT * INTO v_approved_domain
  FROM public.approved_domains
  WHERE lower(domain) = v_domain
  LIMIT 1;

  IF v_approved_domain.domain IS NULL THEN
    -- Domain not approved — this should have been caught by the BEFORE INSERT
    -- trigger, but as a safety net, default to broker. The trigger will have
    -- already raised an exception before this function runs.
    v_role := 'broker';
  ELSIF v_domain = 'propelwellness.com' THEN
    -- Internal Propel staff → Propel Client Services
    v_role := 'propel_csm';
  ELSE
    -- Approved external domain → broker
    v_role := 'broker';
  END IF;

  -- Create profile with determined role (idempotent)
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

  -- For external broker domains, auto-create or join the mapped organization
  IF v_role = 'broker' AND v_approved_domain.domain IS NOT NULL AND v_domain != 'propelwellness.com' THEN
    -- Find or create an organization for this domain
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

    -- Add user as broker member (idempotent)
    INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
    VALUES (v_org_id, NEW.id, 'broker', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
