/*
# Revoke explicit EXECUTE from anon on non-respondent SECURITY DEFINER functions

## Problem
The previous migration revoked PUBLIC EXECUTE, but explicit grants to the
`anon` role remain from the original CREATE FUNCTION statements (Supabase
defaults grant EXECUTE to anon). These need to be revoked too.

## Fix
Revoke EXECUTE from `anon` on all functions except the three respondent-facing
ones that use secure_token for authorization (no JWT required):
  - resolve_assessment_by_token
  - submit_assessment_response
  - finalize_assessment_submission

## Security
After this, anon can only call the three respondent-facing functions via RPC.
All other SECURITY DEFINER functions require an authenticated JWT.
*/

REVOKE EXECUTE ON FUNCTION public.admin_list_all_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_assessment_scores(p_instance_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_account_setup(p_first_name text, p_last_name text, p_avg_client_size text, p_territory text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_assessment_version(p_source_version_id uuid, p_created_by uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_broker_no_recommendation_framework() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_broker() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_instance_owner(p_instance_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_template_owner(p_template_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_version_owner(p_version_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_version_published(p_version_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_published_version() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_bands() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_options() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_questions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_sections() FROM anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_assessment_token(p_instance_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retire_assessment_version(p_version_id uuid) FROM anon;

-- Respondent-facing functions KEEP anon EXECUTE (authorized by secure_token):
--   resolve_assessment_by_token
--   submit_assessment_response
--   finalize_assessment_submission