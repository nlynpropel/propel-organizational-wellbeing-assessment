/*
# Add server-side domain validation RPC

## Overview
Adds a `check_email_domain_approved` RPC that validates whether an email's domain
is on the approved list. This is callable by anon (pre-login) so the login page
can enforce domain validation server-side before sending a magic link.

## Security
- SECURITY DEFINER (reads approved_domains which has RLS — anon may not have SELECT).
- Returns boolean only — no data leakage.
- Granted to anon and authenticated.
*/

DROP FUNCTION IF EXISTS public.check_email_domain_approved(text);

CREATE OR REPLACE FUNCTION public.check_email_domain_approved(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.approved_domains
  WHERE lower(domain) = lower(split_part(p_email, '@', 2))
);
$function$;

GRANT EXECUTE ON FUNCTION public.check_email_domain_approved(text) TO anon, authenticated;
