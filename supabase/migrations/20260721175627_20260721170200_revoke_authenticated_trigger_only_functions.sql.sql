/*
# Revoke EXECUTE from authenticated on trigger-only SECURITY DEFINER functions

## Problem
Trigger-only functions (handle_new_user, enforce_broker_no_recommendation_framework,
protect_published_version*) still have EXECUTE granted to authenticated.
These are only invoked by database triggers, which run as the table owner,
not as the calling user. They should not be callable via RPC by any role.

## Fix
Revoke EXECUTE from authenticated on trigger-only functions.

## Security
Triggers run with the table owner's privileges, so they don't need explicit
EXECUTE grants. After this, these functions cannot be called via the
PostgREST RPC endpoint by any role (anon or authenticated).
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_broker_no_recommendation_framework() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_published_version() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_bands() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_options() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_questions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_published_version_sections() FROM authenticated;