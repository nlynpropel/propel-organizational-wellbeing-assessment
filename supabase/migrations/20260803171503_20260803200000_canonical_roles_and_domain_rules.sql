/*
# Canonical Roles, Domain Assignment Rules, Idempotent Triggers, Data Repair

Introduces canonical roles (superadmin, propel_csm, propel_sales, broker), fixes
domain-based assignment rules, makes creation idempotent, and repairs data.
Data migration runs BEFORE constraint changes. The old constraint from the
initial schema (role IN ('admin','broker')) is dropped first.
*/

-- ============================================================
-- 1. Drop old constraints FIRST so data migration can proceed
-- ============================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- ============================================================
-- 2. Data repair: migrate legacy roles
-- ============================================================

UPDATE public.profiles SET role = 'superadmin' WHERE role = 'admin';
UPDATE public.organization_memberships SET role = 'broker' WHERE role = 'advisor';
UPDATE public.organization_memberships SET role = 'superadmin' WHERE role = 'platform_admin';

-- ============================================================
-- 3. Add new constraints with canonical roles
-- ============================================================

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'propel_csm', 'propel_sales', 'broker'));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('invited', 'active', 'suspended', 'archived', 'setup_incomplete'));

-- ============================================================
-- 4. Unique constraint on organization_memberships(profile_id)
-- ============================================================

DELETE FROM public.organization_memberships
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY created_at ASC) as rn
    FROM public.organization_memberships
  ) t WHERE rn = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_profile_id_unique
ON public.organization_memberships (profile_id);

-- ============================================================
-- 5. Update is_active_admin() to check superadmin
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'superadmin'
  AND status = 'active'
);
$function$;

-- ============================================================
-- 6. Update handle_new_user() trigger with domain assignment rules
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_domain text;
  v_org_id uuid;
  v_profile_exists boolean;
  v_membership_exists boolean;
  v_approved_domain public.approved_domains%ROWTYPE;
  v_is_propel_domain boolean;
  v_assigned_role text;
  v_assigned_status text;
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = NEW.id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
      NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NULL)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT ad.* INTO v_approved_domain
  FROM public.approved_domains ad
  WHERE lower(ad.domain) = v_domain
  LIMIT 1;

  v_is_propel_domain := false;
  IF v_approved_domain.id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.organizations o
      WHERE lower(o.organization_name) = lower(COALESCE(v_approved_domain.organization_name, ''))
      AND o.organization_type = 'propel'
      AND o.status = 'active'
    ) INTO v_is_propel_domain;
  END IF;

  IF v_is_propel_domain THEN
    v_assigned_role := 'broker';
    v_assigned_status := 'setup_incomplete';
    v_org_id := NULL;
  ELSEIF v_approved_domain.id IS NOT NULL THEN
    SELECT o.id INTO v_org_id
    FROM public.organizations o
    WHERE lower(o.organization_name) = lower(COALESCE(v_approved_domain.organization_name, ''))
    AND o.organization_type != 'propel'
    AND o.status = 'active'
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      v_assigned_role := 'broker';
      v_assigned_status := 'invited';
    ELSE
      v_assigned_role := 'broker';
      v_assigned_status := 'setup_incomplete';
      v_org_id := NULL;
    END IF;
  ELSE
    v_assigned_role := 'broker';
    v_assigned_status := 'setup_incomplete';
    v_org_id := NULL;
  END IF;

  UPDATE public.profiles
  SET role = v_assigned_role, status = v_assigned_status
  WHERE id = NEW.id AND status = 'invited';

  IF v_org_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.organization_memberships WHERE profile_id = NEW.id
    ) INTO v_membership_exists;

    IF NOT v_membership_exists THEN
      INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
      VALUES (v_org_id, NEW.id, 'broker', 'invited')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (NEW.id, NEW.id, 'self_service_signup',
    jsonb_build_object(
      'email', NEW.email, 'domain', v_domain,
      'is_propel_domain', v_is_propel_domain,
      'assigned_role', v_assigned_role,
      'assigned_status', v_assigned_status,
      'organization_id', v_org_id
    ));

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 7. Update admin_list_all_users()
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_list_all_users();

CREATE OR REPLACE FUNCTION public.admin_list_all_users()
RETURNS TABLE (
  id uuid, email text, first_name text, last_name text,
  role text, status text, account_setup_complete boolean,
  created_at timestamptz, last_sign_in_at timestamptz,
  organization_id uuid, organization_name text, organization_type text,
  membership_role text, membership_status text, is_internal boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id, u.email, p.first_name, p.last_name,
    p.role, p.status, p.account_setup_complete,
    u.created_at, u.last_sign_in_at,
    om.organization_id, o.organization_name, o.organization_type,
    om.role AS membership_role, om.status AS membership_status,
    (o.organization_type = 'propel') AS is_internal
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.organization_memberships om ON om.profile_id = u.id
  LEFT JOIN public.organizations o ON o.id = om.organization_id
  ORDER BY u.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_all_users() TO authenticated;

-- ============================================================
-- 8. Update admin_invite_user() for canonical roles
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_invite_user(text, text, uuid);

CREATE OR REPLACE FUNCTION public.admin_invite_user(p_email text, p_role text, p_organization_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_role NOT IN ('superadmin', 'propel_csm', 'propel_sales', 'broker') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, consumption
    )
    SELECT
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      lower(p_email),
      NULL, now(), now(), now(),
      jsonb_build_object('provider', 'email'),
      jsonb_build_object('invited_by', auth.uid()),
      false, '{}'::jsonb
    RETURNING id INTO v_user_id;
  END IF;

  INSERT INTO public.profiles (id, email, role, status, account_setup_complete)
  VALUES (v_user_id, lower(p_email), p_role, 'invited', false)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      status = CASE WHEN public.profiles.status = 'active' THEN 'active' ELSE 'invited' END,
      updated_at = now();

  IF p_organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
    VALUES (p_organization_id, v_user_id, 'broker', 'invited')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), v_user_id, 'user_invited',
    jsonb_build_object('email', p_email, 'role', p_role, 'organization_id', p_organization_id));

  RETURN v_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_invite_user(text, text, uuid) TO authenticated;

-- ============================================================
-- 9. New admin_assign_role() RPC
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_assign_role(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_assign_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_role text;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_role NOT IN ('superadmin', 'propel_csm', 'propel_sales', 'broker') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id;
  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, previous_values, new_values)
  VALUES (auth.uid(), p_user_id, 'role_assigned',
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, text) TO authenticated;

-- ============================================================
-- 10. New admin_assign_organization() RPC
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_assign_organization(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_assign_organization(p_user_id uuid, p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_org_id uuid;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT organization_id INTO v_old_org_id
  FROM public.organization_memberships WHERE profile_id = p_user_id;

  INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
  VALUES (p_organization_id, p_user_id, 'broker', 'invited')
  ON CONFLICT (profile_id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id, updated_at = now();

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, previous_values, new_values)
  VALUES (auth.uid(), p_user_id, 'organization_assigned',
    jsonb_build_object('organization_id', v_old_org_id),
    jsonb_build_object('organization_id', p_organization_id));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_assign_organization(uuid, uuid) TO authenticated;

-- ============================================================
-- 11. Update admin_repair_user()
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_repair_user(uuid);

CREATE OR REPLACE FUNCTION public.admin_repair_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
  v_profile_exists boolean;
  v_membership_exists boolean;
  v_org_id uuid;
  v_profile_role text;
  v_result jsonb;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_profile_exists;
  SELECT EXISTS(SELECT 1 FROM public.organization_memberships WHERE profile_id = p_user_id) INTO v_membership_exists;

  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (id, email, role, status, account_setup_complete)
    VALUES (p_user_id, v_email, 'broker', 'setup_incomplete', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF NOT v_membership_exists THEN
    SELECT role INTO v_profile_role FROM public.profiles WHERE id = p_user_id;
    IF v_profile_role IN ('superadmin', 'propel_csm', 'propel_sales') THEN
      SELECT id INTO v_org_id
      FROM public.organizations
      WHERE organization_type = 'propel' AND status = 'active'
      ORDER BY created_at ASC LIMIT 1;

      IF v_org_id IS NOT NULL THEN
        INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
        VALUES (v_org_id, p_user_id, 'superadmin', 'active')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'profile_created', NOT v_profile_exists,
    'membership_created', NOT v_membership_exists AND v_org_id IS NOT NULL
  );

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), p_user_id, 'profile_repaired', v_result);

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_repair_user(uuid) TO authenticated;

-- ============================================================
-- 12. Data repair: remove external brokers from Propel internal org
-- ============================================================

DELETE FROM public.organization_memberships
WHERE profile_id IN (
  SELECT id FROM public.profiles WHERE role = 'broker'
)
AND organization_id IN (
  SELECT id FROM public.organizations WHERE organization_type = 'propel'
);

-- ============================================================
-- 13. Data repair: create missing memberships for internal users
-- ============================================================

INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
SELECT o.id, p.id, 'superadmin', 'active'
FROM public.profiles p
CROSS JOIN (
  SELECT id FROM public.organizations
  WHERE organization_type = 'propel' AND status = 'active'
  ORDER BY created_at ASC LIMIT 1
) o
WHERE p.role IN ('superadmin', 'propel_csm', 'propel_sales')
AND NOT EXISTS (
  SELECT 1 FROM public.organization_memberships om WHERE om.profile_id = p.id
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 14. Data repair: mark brokers without org as setup_incomplete
-- ============================================================

UPDATE public.profiles
SET status = 'setup_incomplete'
WHERE role = 'broker'
AND NOT EXISTS (
  SELECT 1 FROM public.organization_memberships om WHERE om.profile_id = profiles.id
)
AND status = 'invited';

-- ============================================================
-- 15. Update organization_role_capabilities for canonical roles
-- ============================================================

INSERT INTO public.organization_role_capabilities (role, capability)
SELECT 'superadmin', cap FROM (VALUES
  ('superadmin', 'access_admin_tools'),
  ('superadmin', 'approve_strategy_analysis'),
  ('superadmin', 'create_assessments'),
  ('superadmin', 'edit_strategy_analysis'),
  ('superadmin', 'generate_ai_analysis'),
  ('superadmin', 'manage_clients'),
  ('superadmin', 'manage_incentive_designs'),
  ('superadmin', 'manage_organization_members'),
  ('superadmin', 'manage_organization_playbook'),
  ('superadmin', 'publish_assessments'),
  ('superadmin', 'send_assessments'),
  ('superadmin', 'view_reports')
) AS t(role, cap)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_role_capabilities orc
  WHERE orc.role = 'superadmin' AND orc.capability = cap
);

INSERT INTO public.organization_role_capabilities (role, capability)
SELECT 'propel_csm', cap FROM (VALUES
  ('propel_csm', 'create_assessments'),
  ('propel_csm', 'generate_ai_analysis'),
  ('propel_csm', 'manage_clients'),
  ('propel_csm', 'send_assessments'),
  ('propel_csm', 'view_reports')
) AS t(role, cap)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_role_capabilities orc
  WHERE orc.role = 'propel_csm' AND orc.capability = cap
);

INSERT INTO public.organization_role_capabilities (role, capability)
SELECT 'propel_sales', cap FROM (VALUES
  ('propel_sales', 'create_assessments'),
  ('propel_sales', 'generate_ai_analysis'),
  ('propel_sales', 'manage_clients'),
  ('propel_sales', 'send_assessments'),
  ('propel_sales', 'view_reports')
) AS t(role, cap)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_role_capabilities orc
  WHERE orc.role = 'propel_sales' AND orc.capability = cap
);

INSERT INTO public.organization_role_capabilities (role, capability)
SELECT 'broker', cap FROM (VALUES
  ('broker', 'create_assessments'),
  ('broker', 'generate_ai_analysis'),
  ('broker', 'manage_clients'),
  ('broker', 'send_assessments'),
  ('broker', 'view_reports')
) AS t(role, cap)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_role_capabilities orc
  WHERE orc.role = 'broker' AND orc.capability = cap
);
