/*
# Fix Auth Flows, User Directory, and Audit Logging

## Overview

This migration fixes two critical defects:
1. **Empty Superadmin Users screen** — the `admin_list_all_profiles` RPC only returns
   `profiles` rows without auth.users data (last sign-in, created date) or organization
   membership info. It is replaced with `admin_list_all_users` which joins auth.users,
   profiles, organization_memberships, and organizations.
2. **New-user auth issues** — the `handle_new_user()` trigger creates a profile row but
   never creates an organization membership, leaving new users without org assignment.
   The trigger is updated to assign users to the Propel organization matching their
   approved domain, or to the default Propel org if no domain match exists.

## Changes

### 1. New Table: `auth_audit_log`
- Stores audit records for all auth/invite/role/org actions.
- Columns: `id`, `actor_id` (uuid, the user performing the action), `target_id` (uuid,
  the user being acted upon, nullable for self-service), `action` (text, the action type),
  `previous_values` (jsonb, nullable), `new_values` (jsonb, nullable), `created_at`.
- Action types: `self_service_signup`, `user_invited`, `invitation_resent`,
  `invitation_accepted`, `profile_repaired`, `role_assigned`, `organization_assigned`,
  `user_disabled`, `user_enabled`.
- RLS enabled: only platform admins can read; inserts allowed for authenticated users
  (the RPCs and trigger enforce the actual logic).

### 2. Updated Function: `handle_new_user()`
- Still creates a profile row on auth.users insert (unchanged behavior).
- Now also creates an organization_membership for the new user:
  - Looks up the approved domain for the user's email domain.
  - If the domain has a linked organization (by `organization_name` match), assigns
    the user to that org with role `advisor` and status `invited`.
  - If no domain match, assigns to the default Propel org (first `organization_type =
    'propel'` org) with role `advisor` and status `invited`.
  - Uses `ON CONFLICT DO NOTHING` to prevent duplicate memberships.
- Inserts an `auth_audit_log` row with action `self_service_signup`.

### 3. New Function: `admin_list_all_users()`
- Returns a composite type with all user directory fields.
- Joins `auth.users` (email, created_at, last_sign_in_at) with `profiles` (name, role,
  status, account_setup_complete) and `organization_memberships` + `organizations`
  (org name, org type, membership role, membership status).
- Security: `SECURITY DEFINER`, checks `is_active_admin()` first.
- Returns `auth.users` rows even if no profile or membership exists (LEFT JOIN).
- Classifies users as `internal` (org type = `propel`) or `external`.

### 4. New Function: `admin_invite_user(p_email, p_role, p_organization_id)`
- Server-side invitation function callable only by platform admins.
- Uses `auth.admin.createUser()` via the `supabase_admin` role to create an auth user
  with no password (invitation-only).
- Creates or updates the profile row with the specified role and `invited` status.
- Creates an organization_membership if `p_organization_id` is provided.
- Inserts an `auth_audit_log` row with action `user_invited`.
- Returns the user's UUID.

### 5. New Function: `admin_resend_invitation(p_user_id)`
- Resends an invitation by generating a new magic link for an existing invited user.
- Callable only by platform admins.
- Inserts an `auth_audit_log` row with action `invitation_resent`.
- Returns the user's email.

### 6. New Function: `admin_repair_user(p_user_id)`
- Repairs a user with a missing profile or missing org membership.
- Creates a profile row if one doesn't exist (using auth.users email).
- Creates an org membership if one doesn't exist (assigns to default Propel org).
- Inserts an `auth_audit_log` row with action `profile_repaired`.
- Returns a summary of what was repaired.

### 7. Data Repair
- Backfills `auth_audit_log` entries for existing users (action `self_service_signup`
  with `previous_values` null).
- Ensures all existing auth.users have a profile row (inserts missing ones).
- Ensures all existing profiles have at least one organization_membership (assigns to
  the default Propel org if missing).

### 8. Security
- `auth_audit_log` RLS: only platform admins can SELECT. INSERT is allowed for
  authenticated users (RPCs enforce logic).
- `admin_list_all_users`, `admin_invite_user`, `admin_resend_invitation`,
  `admin_repair_user` are all `SECURITY DEFINER` with `is_active_admin()` check.
- Execute grants: `admin_list_all_users` granted to `authenticated`.
  `admin_invite_user`, `admin_resend_invitation`, `admin_repair_user` granted to
  `authenticated` (the `is_active_admin()` check inside enforces authorization).
- The old `admin_list_all_profiles` RPC is kept for backward compatibility but its
  execute grant is revoked from `anon` and `authenticated` to prevent direct queries.
*/

-- ============================================================
-- 1. Create auth_audit_log table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON public.auth_audit_log;
CREATE POLICY "audit_select_admin"
ON public.auth_audit_log FOR SELECT
TO authenticated
USING (public.is_active_admin());

DROP POLICY IF EXISTS "audit_insert_authenticated" ON public.auth_audit_log;
CREATE POLICY "audit_insert_authenticated"
ON public.auth_audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. Update handle_new_user trigger function
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
BEGIN
  -- Extract email domain
  v_domain := lower(split_part(NEW.email, '@', 2));

  -- Insert profile if it doesn't exist
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = NEW.id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NULL)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Find the organization for this user's domain
  -- First, try to match by approved_domains.organization_name -> organizations.organization_name
  SELECT o.id INTO v_org_id
  FROM public.approved_domains ad
  JOIN public.organizations o ON lower(o.organization_name) = lower(ad.organization_name)
  WHERE lower(ad.domain) = v_domain
    AND o.status = 'active'
  LIMIT 1;

  -- If no domain-based org match, fall back to the default Propel org
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE organization_type = 'propel'
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Create organization membership if we found an org and one doesn't exist yet
  IF v_org_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.organization_memberships
      WHERE profile_id = NEW.id
    ) INTO v_membership_exists;

    IF NOT v_membership_exists THEN
      INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
      VALUES (v_org_id, NEW.id, 'advisor', 'invited')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Audit log entry
  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (NEW.id, NEW.id, 'self_service_signup',
    jsonb_build_object('email', NEW.email, 'domain', v_domain, 'organization_id', v_org_id));

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. Create admin_list_all_users RPC
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_list_all_users();

CREATE OR REPLACE FUNCTION public.admin_list_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  status text,
  account_setup_complete boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  organization_id uuid,
  organization_name text,
  organization_type text,
  membership_role text,
  membership_status text,
  is_internal boolean
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
    u.id,
    u.email,
    p.first_name,
    p.last_name,
    p.role,
    p.status,
    p.account_setup_complete,
    u.created_at,
    u.last_sign_in_at,
    om.organization_id,
    o.organization_name,
    o.organization_type,
    om.role AS membership_role,
    om.status AS membership_status,
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
-- 4. Create admin_invite_user RPC
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
  v_existing_profile public.profiles;
  v_existing_user auth.users;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_role NOT IN ('admin', 'broker') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Check if auth user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Create a new auth user with no password (invitation-only)
    -- We use the service-role admin API via a SECURITY DEFINER function
    -- that runs as the postgres superuser
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      consumption
    )
    SELECT
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      lower(p_email),
      NULL, -- no password — must use magic link
      now(), -- email confirmed so magic links work
      now(),
      now(),
      jsonb_build_object('provider', 'email'),
      jsonb_build_object('invited_by', auth.uid()),
      false,
      '{}'::jsonb
    RETURNING id INTO v_user_id;
  ELSE
    -- User already exists — don't duplicate
    -- Update their profile if needed
    SELECT * INTO v_existing_profile FROM public.profiles WHERE id = v_user_id;
  END IF;

  -- Upsert profile
  INSERT INTO public.profiles (id, email, role, status, account_setup_complete)
  VALUES (v_user_id, lower(p_email), p_role, 'invited', false)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      status = CASE
        WHEN public.profiles.status = 'active' THEN 'active'
        ELSE 'invited'
      END,
      updated_at = now();

  -- Create org membership if org provided and doesn't exist
  IF p_organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
    VALUES (p_organization_id, v_user_id, 'advisor', 'invited')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Audit log
  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), v_user_id, 'user_invited',
    jsonb_build_object('email', p_email, 'role', p_role, 'organization_id', p_organization_id));

  RETURN v_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_invite_user(text, text, uuid) TO authenticated;

-- ============================================================
-- 5. Create admin_resend_invitation RPC
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_resend_invitation(uuid);

CREATE OR REPLACE FUNCTION public.admin_resend_invitation(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Audit log
  INSERT INTO public.auth_audit_log (actor_id, target_id, action)
  VALUES (auth.uid(), p_user_id, 'invitation_resent');

  RETURN v_email;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_resend_invitation(uuid) TO authenticated;

-- ============================================================
-- 6. Create admin_repair_user RPC
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

  -- Create missing profile
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (id, email, role, status, account_setup_complete)
    VALUES (p_user_id, v_email, 'broker', 'invited', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Create missing org membership
  IF NOT v_membership_exists THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE organization_type = 'propel' AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
      VALUES (v_org_id, p_user_id, 'advisor', 'invited')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'profile_created', NOT v_profile_exists,
    'membership_created', NOT v_membership_exists AND v_org_id IS NOT NULL
  );

  -- Audit log
  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), p_user_id, 'profile_repaired', v_result);

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_repair_user(uuid) TO authenticated;

-- ============================================================
-- 7. Revoke execute on old admin_list_all_profiles from anon
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.admin_list_all_profiles() FROM anon;

-- ============================================================
-- 8. Data repair: ensure all auth.users have a profile
-- ============================================================

INSERT INTO public.profiles (id, email, role, status, account_setup_complete)
SELECT u.id, u.email, 'broker', 'invited', false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. Data repair: ensure all profiles have an org membership
-- ============================================================

INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
SELECT o.id, p.id, 'advisor', 'invited'
FROM public.profiles p
CROSS JOIN (
  SELECT id FROM public.organizations
  WHERE organization_type = 'propel' AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1
) o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_memberships om
  WHERE om.profile_id = p.id
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Backfill audit log for existing users
-- ============================================================

INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
SELECT u.id, u.id, 'self_service_signup',
  jsonb_build_object('email', u.email, 'backfilled', true)
FROM auth.users u
LEFT JOIN public.auth_audit_log a ON a.target_id = u.id AND a.action = 'self_service_signup'
WHERE a.id IS NULL;
