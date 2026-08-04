/*
# Also mark password_set on INSERT when password is already present

The existing mark_password_set trigger only fires AFTER UPDATE, checking
if encrypted_password transitions from NULL to non-NULL. But self-service
sign-ups set the password at INSERT time, so the trigger never fires for
them. This migration adds a separate AFTER INSERT trigger that marks
password_set=true when the user already has an encrypted_password at
creation time.

1. New function: mark_password_set_on_insert() — SECURITY DEFINER trigger
   on auth.users AFTER INSERT.
2. New trigger: trg_mark_password_set_on_insert.
*/

CREATE OR REPLACE FUNCTION public.mark_password_set_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encrypted_password IS NOT NULL AND NEW.encrypted_password <> '' THEN
    UPDATE public.profiles
    SET password_set = true, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_password_set_on_insert ON auth.users;
CREATE TRIGGER trg_mark_password_set_on_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_password_set_on_insert();
