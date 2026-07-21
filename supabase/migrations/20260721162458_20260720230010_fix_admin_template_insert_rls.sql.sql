/*
# Fix admin assessment template creation

## Problem
Admins could create Propel-owned assessments but not broker-owned ones.
The `assessment_templates_insert` RLS policy only allowed:
  - is_active_admin() AND owner_type='propel'
  - is_active_broker() AND owner_type='broker' AND owner_profile_id=auth.uid()

An admin creating a broker-owned assessment (for testing/admin) fails the
`is_active_broker()` check, since admins are not brokers.

## Fix
Allow admins to insert any owner_type. Brokers remain restricted to
broker-owned with owner_profile_id = themselves and recommendations_enabled = false.

## Security
Does not loosen RLS broadly. Admins already have full access via is_active_admin().
Brokers are still constrained to their own templates.
*/

DROP POLICY IF EXISTS "assessment_templates_insert" ON public.assessment_templates;

CREATE POLICY "assessment_templates_insert" ON public.assessment_templates
  FOR INSERT TO authenticated WITH CHECK (
    (public.is_active_admin())
    OR (public.is_active_broker() AND owner_type = 'broker' AND owner_profile_id = auth.uid() AND recommendations_enabled = false)
  );