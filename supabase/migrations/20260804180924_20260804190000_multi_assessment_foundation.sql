/*
# Multi-assessment foundation

1. assessment_role_access table — controls which canonical roles can view/send/view_reports for each assessment template
2. respondent_intro_text column on assessment_versions — assessment-specific intro copy
3. Seed default access for the existing Propel Well-being Opportunity Index
*/

-- ============================================================
-- 1. assessment_role_access table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assessment_role_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('superadmin', 'propel_csm', 'propel_sales', 'broker')),
  can_view boolean NOT NULL DEFAULT true,
  can_send boolean NOT NULL DEFAULT false,
  can_view_reports boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_template_id, role)
);

ALTER TABLE public.assessment_role_access ENABLE ROW LEVEL SECURITY;

-- Superadmin can manage all access rows
CREATE POLICY "select_assessment_role_access_all"
  ON public.assessment_role_access FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_assessment_role_access_superadmin"
  ON public.assessment_role_access FOR INSERT
  TO authenticated WITH CHECK (public.is_active_admin());

CREATE POLICY "update_assessment_role_access_superadmin"
  ON public.assessment_role_access FOR UPDATE
  TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "delete_assessment_role_access_superadmin"
  ON public.assessment_role_access FOR DELETE
  TO authenticated USING (public.is_active_admin());

-- ============================================================
-- 2. respondent_intro_text column on assessment_versions
-- ============================================================

ALTER TABLE public.assessment_versions
  ADD COLUMN IF NOT EXISTS respondent_intro_text text;

-- ============================================================
-- 3. Seed default access for existing published Propel template
--    superadmin: full access (bypasses table anyway, but explicit for clarity)
--    propel_csm: view + send + reports
--    propel_sales: view + send + reports
--    broker: view + send + reports (preserves current broker access)
-- ============================================================

INSERT INTO public.assessment_role_access (assessment_template_id, role, can_view, can_send, can_view_reports)
SELECT t.id, r.role, r.can_view, r.can_send, r.can_view_reports
FROM public.assessment_templates t
CROSS JOIN (
  VALUES
    ('superadmin', true, true, true),
    ('propel_csm', true, true, true),
    ('propel_sales', true, true, true),
    ('broker', true, true, true)
) AS r(role, can_view, can_send, can_view_reports)
WHERE t.owner_type = 'propel' AND t.status = 'published'
ON CONFLICT (assessment_template_id, role) DO NOTHING;

-- ============================================================
-- 4. Set default respondent intro text on the existing published version
-- ============================================================

UPDATE public.assessment_versions
SET respondent_intro_text = 'An assessment for identifying well-being strategy maturity, behavioral barriers, and priority opportunities.'
WHERE status = 'published'
  AND respondent_intro_text IS NULL;
