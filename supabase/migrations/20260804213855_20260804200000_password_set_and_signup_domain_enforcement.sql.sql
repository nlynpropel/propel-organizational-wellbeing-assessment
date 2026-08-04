/*
# Add password_set column and enforce approved domains on self-service sign-up

1. Schema changes
- Add `password_set` boolean column to `profiles` (defaults to false).
  This distinguishes invited users (who authenticated via invitation link but
  have not yet chosen a password) from users who completed password setup.
  Existing active users are backfilled to true so they are not prompted to set
  a password.

2. Security changes
- Add a trigger `enforce_approved_domain_on_signup` on `auth.users` BEFORE INSERT
  that rejects self-service sign-ups whose email domain is not on the
  approved_domains list.  Inserts originating from `admin_invite_user` are
  exempted — those inserts carry `raw_user_meta_data.invited_by`, which the
  trigger checks to skip the domain gate for admin-initiated invitations
  (admin_invite_user already validates the domain itself).
- This makes approved-domain enforcement server-side for BOTH self-service
  sign-up and superadmin invitations, so the LoginPage client-side check is
  defense-in-depth rather than the only gate.

3. Important notes
- The trigger is SECURITY DEFINER so it can read public.approved_domains
  even though the inserting role is anon.
- The trigger only fires on genuine new-user sign-ups (INSERT), not on
  admin invitations that use raw_user_meta_data.invited_by.
- Existing profiles are backfilled with password_set = true so current
  active users are unaffected.
*/

-- ============================================================
-- 1. Add password_set column to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;

-- Backfill: any profile that is already active or has ever signed in
-- is considered to have a password set.
UPDATE public.profiles
SET password_set = true
WHERE status IN ('active', 'setup_incomplete')
   OR last_login_at IS NOT NULL;

-- ============================================================
-- 2. Trigger: enforce approved domain on self-service sign-up
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_approved_domain_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_approved boolean;
  v_is_admin_invite boolean;
BEGIN
  -- Skip domain enforcement for admin-initiated invitations.
  -- admin_invite_user sets raw_user_meta_data.invited_by.
  v_is_admin_invite := (NEW.raw_user_meta_data ? 'invited_by');

  IF v_is_admin_invite THEN
    RETURN NEW;
  END IF;

  -- Extract domain from email
  v_domain := lower(split_part(NEW.email, '@', 2));
  IF v_domain = '' OR v_domain IS NULL THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.approved_domains WHERE lower(domain) = v_domain
  ) INTO v_approved;

  IF NOT v_approved THEN
    RAISE EXCEPTION 'Email domain @% is not approved. Sign-up is restricted to approved organizational domains.', v_domain;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_approved_domain_on_signup ON auth.users;
CREATE TRIGGER trg_enforce_approved_domain_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_approved_domain_on_signup();

-- The trigger function needs to run with elevated privileges to read
-- approved_domains even when the anon role is inserting.
REVOKE ALL ON FUNCTION public.enforce_approved_domain_on_signup() FROM PUBLIC;
-- No explicit GRANT needed — trigger functions run as the definer.
