/*
# Neutral Organization Foundation

## Purpose
Neutralize broker-specific architecture so the platform can support brokerages,
Propel internal users, employers, consultants, and future non-broker users.

## Changes

### 1. organizations table
- Add `organization_type` column: propel, brokerage, employer, consultancy, partner, other.
- Add `status` column: active, archived.
- Legacy `broker_id` retained temporarily.

### 2. New tables
- organization_memberships: links profiles to organizations with role + status.
- organization_client_relationships: maps service orgs to client orgs.
- organization_role_capabilities: maps roles to capability strings.

### 3. Helper functions
- has_platform_admin(): checks for active platform_admin membership.
- has_capability(p_capability): checks user capabilities via memberships.

### 4. Data backfill
- Admin profiles → propel org + platform_admin membership.
- Broker profiles → brokerage org + advisor membership.
- Employer orgs → client relationships from their broker's brokerage org.

### 5. Security
- RLS on all new tables. No USING(true) shortcuts.
- organization_role_capabilities readable by all authenticated users.
*/

-- ============================================================
-- 1. Add columns to organizations
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS organization_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE public.organizations
SET status = 'archived', organization_type = 'employer'
WHERE archived_at IS NOT NULL AND organization_type IS NULL;

UPDATE public.organizations
SET organization_type = 'employer'
WHERE organization_type IS NULL;

-- ============================================================
-- 2. Create tables (before functions that reference them)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.organization_client_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'advisor',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_organization_id, client_organization_id)
);

CREATE TABLE IF NOT EXISTS public.organization_role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  capability text NOT NULL,
  UNIQUE (role, capability)
);

-- ============================================================
-- 3. Helper functions (tables now exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.profile_id = auth.uid()
      AND om.role = 'platform_admin'
      AND om.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    JOIN public.organization_role_capabilities orc ON orc.role = om.role
    WHERE om.profile_id = auth.uid()
      AND om.status = 'active'
      AND orc.capability = p_capability
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_platform_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_capability(text) TO authenticated;

-- ============================================================
-- 4. Enable RLS and create policies
-- ============================================================
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_memberships" ON organization_memberships;
CREATE POLICY "select_own_memberships" ON organization_memberships
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.has_platform_admin());

DROP POLICY IF EXISTS "insert_memberships_admin" ON organization_memberships;
CREATE POLICY "insert_memberships_admin" ON organization_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.has_platform_admin());

DROP POLICY IF EXISTS "update_memberships_admin" ON organization_memberships;
CREATE POLICY "update_memberships_admin" ON organization_memberships
  FOR UPDATE TO authenticated
  USING (public.has_platform_admin()) WITH CHECK (public.has_platform_admin());

DROP POLICY IF EXISTS "delete_memberships_admin" ON organization_memberships;
CREATE POLICY "delete_memberships_admin" ON organization_memberships
  FOR DELETE TO authenticated
  USING (public.has_platform_admin());

ALTER TABLE public.organization_client_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_relationships_member" ON organization_client_relationships;
CREATE POLICY "select_relationships_member" ON organization_client_relationships
  FOR SELECT TO authenticated
  USING (
    public.has_platform_admin()
    OR service_organization_id IN (
      SELECT om.organization_id FROM public.organization_memberships om
      WHERE om.profile_id = auth.uid() AND om.status = 'active'
    )
    OR client_organization_id IN (
      SELECT om.organization_id FROM public.organization_memberships om
      WHERE om.profile_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_relationships_admin" ON organization_client_relationships;
CREATE POLICY "insert_relationships_admin" ON organization_client_relationships
  FOR INSERT TO authenticated
  WITH CHECK (public.has_platform_admin());

DROP POLICY IF EXISTS "update_relationships_admin" ON organization_client_relationships;
CREATE POLICY "update_relationships_admin" ON organization_client_relationships
  FOR UPDATE TO authenticated
  USING (public.has_platform_admin()) WITH CHECK (public.has_platform_admin());

DROP POLICY IF EXISTS "delete_relationships_admin" ON organization_client_relationships;
CREATE POLICY "delete_relationships_admin" ON organization_client_relationships
  FOR DELETE TO authenticated
  USING (public.has_platform_admin());

ALTER TABLE public.organization_role_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_role_caps" ON organization_role_capabilities;
CREATE POLICY "select_role_caps" ON organization_role_capabilities
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 5. Seed capability mappings
-- ============================================================
INSERT INTO public.organization_role_capabilities (role, capability) VALUES
  ('platform_admin', 'manage_clients'),
  ('platform_admin', 'create_assessments'),
  ('platform_admin', 'publish_assessments'),
  ('platform_admin', 'send_assessments'),
  ('platform_admin', 'view_reports'),
  ('platform_admin', 'access_admin_tools'),
  ('platform_admin', 'manage_organization_members'),
  ('platform_admin', 'edit_strategy_analysis'),
  ('platform_admin', 'approve_strategy_analysis'),
  ('platform_admin', 'manage_organization_playbook'),
  ('platform_admin', 'generate_ai_analysis'),
  ('platform_admin', 'manage_incentive_designs'),
  ('organization_admin', 'manage_clients'),
  ('organization_admin', 'create_assessments'),
  ('organization_admin', 'send_assessments'),
  ('organization_admin', 'view_reports'),
  ('organization_admin', 'manage_organization_members'),
  ('advisor', 'manage_clients'),
  ('advisor', 'create_assessments'),
  ('advisor', 'send_assessments'),
  ('advisor', 'view_reports'),
  ('client_manager', 'manage_clients'),
  ('client_manager', 'send_assessments'),
  ('client_manager', 'view_reports'),
  ('employer_admin', 'view_reports'),
  ('viewer', 'view_reports')
ON CONFLICT (role, capability) DO NOTHING;

-- ============================================================
-- 6. Data backfill
-- ============================================================

-- 6a. Propel orgs for admin profiles
INSERT INTO public.organizations (organization_name, organization_type, status, broker_id)
SELECT
  COALESCE('Propel (' || p.email || ')', 'Propel'),
  'propel',
  'active',
  p.id
FROM public.profiles p
WHERE p.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.broker_id = p.id AND o.organization_type = 'propel'
  )
ON CONFLICT DO NOTHING;

-- 6b. Brokerage orgs for broker profiles
INSERT INTO public.organizations (organization_name, organization_type, status, broker_id)
SELECT
  COALESCE(NULLIF(TRIM(p.brokerage_name), ''), 'Brokerage (' || p.email || ')'),
  'brokerage',
  'active',
  p.id
FROM public.profiles p
WHERE p.role = 'broker'
  AND NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.broker_id = p.id AND o.organization_type = 'brokerage'
  )
ON CONFLICT DO NOTHING;

-- 6c. Memberships for admins
INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
SELECT o.id, p.id, 'platform_admin', 'active'
FROM public.profiles p
JOIN public.organizations o ON o.broker_id = p.id AND o.organization_type = 'propel'
WHERE p.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.profile_id = p.id AND om.organization_id = o.id
  )
ON CONFLICT DO NOTHING;

-- 6d. Memberships for brokers
INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
SELECT o.id, p.id, 'advisor', 'active'
FROM public.profiles p
JOIN public.organizations o ON o.broker_id = p.id AND o.organization_type = 'brokerage'
WHERE p.role = 'broker'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.profile_id = p.id AND om.organization_id = o.id
  )
ON CONFLICT DO NOTHING;

-- 6e. Client relationships
INSERT INTO public.organization_client_relationships (service_organization_id, client_organization_id, relationship_type, status)
SELECT
  so.id,
  eo.id,
  'broker',
  'active'
FROM public.organizations eo
JOIN public.organizations so
  ON so.broker_id = eo.broker_id AND so.organization_type = 'brokerage'
WHERE eo.organization_type = 'employer'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_client_relationships ocr
    WHERE ocr.service_organization_id = so.id AND ocr.client_organization_id = eo.id
  )
ON CONFLICT DO NOTHING;