/*
# Fix: allow anon users to read approved_domains

1. Purpose
- The login screen runs as the anon (unauthenticated) role. The previous
  approved_domains SELECT policy was scoped TO authenticated only, so the
  domain validation query returned zero rows before sign-in and every email
  was incorrectly rejected as "restricted."
- The approved_domains list is not sensitive — it is an allow-list of which
  email domains may self-register. Allowing anon SELECT is the correct fix,
  consistent with how a pre-authentication domain check must work.

2. Security Changes
- Replace the SELECT policy: TO authenticated → TO anon, authenticated.
- INSERT/UPDATE/DELETE remain admin-only (unchanged).

3. Idempotent
- DROP IF EXISTS before CREATE.
*/

DROP POLICY IF EXISTS "approved_domains_select_any" ON approved_domains;
CREATE POLICY "approved_domains_select_any"
  ON approved_domains FOR SELECT
  TO anon, authenticated
  USING (true);
