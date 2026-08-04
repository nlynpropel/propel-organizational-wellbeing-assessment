/*
# Track password_set automatically on auth.users updates

When an invited user sets their password (via supabase.auth.updateUser or
the recovery flow), the `encrypted_password` column on auth.users changes
from NULL to a bcrypt hash. This migration adds a trigger that detects that
transition and sets `profiles.password_set = true` accordingly, so the
frontend can route password-set users away from the Set Password page.

1. New function: `mark_password_set()` — SECURITY DEFINER trigger on
   auth.users AFTER UPDATE that checks if encrypted_password went from
   NULL to non-NULL, and if so updates the matching profiles row.
2. New trigger: `trg_mark_password_set` on auth.users AFTER UPDATE.
*/

CREATE OR REPLACE FUNCTION public.mark_password_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when password transitions from NULL/empty to a real value
  IF (OLD.encrypted_password IS NULL OR OLD.encrypted_password = '')
     AND (NEW.encrypted_password IS NOT NULL AND NEW.encrypted_password <> '') THEN
    UPDATE public.profiles
    SET password_set = true, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_password_set ON auth.users;
CREATE TRIGGER trg_mark_password_set
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_password_set();
