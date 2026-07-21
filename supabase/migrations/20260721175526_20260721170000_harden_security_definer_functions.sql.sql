/*
# Harden SECURITY DEFINER function permissions

## Problems
1. `public.set_updated_at()` trigger function has a role-mutable search_path.
2. All 23 SECURITY DEFINER functions inherit EXECUTE from PUBLIC, allowing
   the `anon` role to call them via the PostgREST RPC endpoint.

## Fix
1. Recreate `set_updated_at()` with an immutable `SET search_path TO 'public'`.
2. Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions.
3. Grant EXECUTE selectively:
   - Trigger-only functions: no grants (only invoked internally by triggers).
   - RLS helper functions: authenticated only.
   - Respondent-facing functions (token-based, no auth): anon + authenticated.
   - Broker/admin-facing functions: authenticated only.

## Security
- Trigger functions cannot be called via RPC after revoking PUBLIC EXECUTE.
- RLS policies using helper functions still work because the calling role
  (authenticated) has EXECUTE on them.
- Respondent-facing functions use secure_token for authorization, not JWT.
*/

-- ============================================================
-- 1. Fix set_updated_at search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.admin_list_all_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_assessment_scores(p_instance_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_account_setup(p_first_name text, p_last_name text, p_avg_client_size text, p_territory text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_assessment_version(p_source_version_id uuid, p_created_by uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_broker_no_recommendation_framework() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_assessment_submission(p_token uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_broker() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_instance_owner(p_instance_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_template_owner(p_template_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_version_owner(p_version_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_version_published(p_version_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_published_version() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_bands() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_options() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_questions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_sections() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_assessment_token(p_instance_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_assessment_by_token(p_token uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retire_assessment_version(p_version_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_assessment_response(p_token uuid, p_question_id uuid, p_selected_option_id uuid, p_numeric_value numeric, p_text_value text, p_boolean_value boolean) FROM PUBLIC;

-- ============================================================
-- 3. Grant EXECUTE to authenticated on RLS helper functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_broker() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instance_owner(p_instance_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_template_owner(p_template_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_version_owner(p_version_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_version_published(p_version_id uuid) TO authenticated;

-- ============================================================
-- 4. Grant EXECUTE to anon + authenticated on respondent-facing functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.resolve_assessment_by_token(p_token uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_assessment_response(p_token uuid, p_question_id uuid, p_selected_option_id uuid, p_numeric_value numeric, p_text_value text, p_boolean_value boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_assessment_submission(p_token uuid) TO anon, authenticated;

-- ============================================================
-- 5. Grant EXECUTE to authenticated on broker/admin-facing functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.admin_list_all_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_assessment_scores(p_instance_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_setup(p_first_name text, p_last_name text, p_avg_client_size text, p_territory text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_assessment_version(p_source_version_id uuid, p_created_by uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_assessment_token(p_instance_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retire_assessment_version(p_version_id uuid) TO authenticated;

-- Trigger-only functions (handle_new_user, enforce_broker_no_recommendation_framework,
-- protect_published_version*) get NO grants — they are only invoked by triggers.