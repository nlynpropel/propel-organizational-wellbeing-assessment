/*
# Server-side role enforcement for assessment access

1. Helper functions for canonical role checks
2. can_access_assessment_template — checks assessment_role_access table
3. Updated RLS policies on assessment_templates, assessment_versions, assessment_instances
*/

-- ============================================================
-- 1. Role helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_propel_csm()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'propel_csm'
  AND status = 'active'
);
$function$;

CREATE OR REPLACE FUNCTION public.is_active_propel_sales()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'propel_sales'
  AND status = 'active'
);
$function$;

CREATE OR REPLACE FUNCTION public.is_active_platform_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role IN ('superadmin', 'propel_csm', 'propel_sales', 'broker')
  AND status = 'active'
);
$function$;

-- ============================================================
-- 2. can_access_assessment_template — checks role access table
--    Superadmin bypasses; all others require an explicit row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_assessment_template(p_template_id uuid, p_required_permission text DEFAULT 'can_view')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  CASE
    WHEN public.is_active_admin() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.assessment_role_access ara
      JOIN public.profiles p ON p.id = auth.uid() AND p.status = 'active'
      WHERE ara.assessment_template_id = p_template_id
      AND ara.role = p.role
      AND (
        (p_required_permission = 'can_view' AND ara.can_view)
        OR (p_required_permission = 'can_send' AND ara.can_send)
        OR (p_required_permission = 'can_view_reports' AND ara.can_view_reports)
      )
    )
  END
$function$;

GRANT EXECUTE ON FUNCTION public.is_active_propel_csm() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_propel_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_platform_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_assessment_template(uuid, text) TO authenticated;

-- ============================================================
-- 3. Updated RLS policies
-- ============================================================

-- Drop old broker-only select policy on assessment_templates
DROP POLICY IF EXISTS assessment_templates_select ON public.assessment_templates;

-- New select policy: superadmin sees all; platform users see templates they have role access to
CREATE POLICY "assessment_templates_select_role"
  ON public.assessment_templates FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.is_active_platform_user()
      AND public.can_access_assessment_template(id, 'can_view')
    )
  );

-- Drop old broker-only select policies on assessment_versions
DROP POLICY IF EXISTS assessment_versions_select ON public.assessment_versions;
DROP POLICY IF EXISTS assessment_versions_select_broker ON public.assessment_versions;

-- New select policy: superadmin sees all; platform users see versions of templates they can access
CREATE POLICY "assessment_versions_select_role"
  ON public.assessment_versions FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.is_active_platform_user()
      AND public.can_access_assessment_template(assessment_template_id, 'can_view')
    )
  );

-- Drop old broker-only select policies on assessment_instances
DROP POLICY IF EXISTS assessment_instances_select_own ON public.assessment_instances;
DROP POLICY IF EXISTS select_instances_neutral ON public.assessment_instances;

-- New select policy: superadmin sees all; platform users see instances for templates they can access
CREATE POLICY "assessment_instances_select_role"
  ON public.assessment_instances FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.is_active_platform_user()
      AND public.can_access_assessment_template(assessment_template_id, 'can_view')
      AND (
        broker_id = auth.uid()
        OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
      )
    )
  );

-- Drop old insert policy (broker-only)
DROP POLICY IF EXISTS assessment_instances_insert_own ON public.assessment_instances;

-- New insert policy: platform users with can_send permission can create instances
CREATE POLICY "assessment_instances_insert_role"
  ON public.assessment_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_admin()
    OR (
      public.is_active_platform_user()
      AND public.can_access_assessment_template(assessment_template_id, 'can_send')
      AND broker_id = auth.uid()
    )
  );

-- Drop old update policies
DROP POLICY IF EXISTS assessment_instances_update_own ON public.assessment_instances;

-- New update policy: platform users with can_send can update their own instances
CREATE POLICY "assessment_instances_update_role"
  ON public.assessment_instances FOR UPDATE
  TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.is_active_platform_user()
      AND broker_id = auth.uid()
      AND public.can_access_assessment_template(assessment_template_id, 'can_send')
    )
  )
  WITH CHECK (
    public.is_active_admin()
    OR (
      public.is_active_platform_user()
      AND broker_id = auth.uid()
      AND public.can_access_assessment_template(assessment_template_id, 'can_send')
    )
  );
