/*
# Add organization_name to approved_domains

1. Changes
- Add `organization_name` column to `approved_domains` table.
- Nullable text column — existing rows and inserts that omit it are unaffected.
- Allows admins to associate a human-readable organization name with each approved email domain.

2. Security
- No RLS policy changes. Existing policies remain intact.
- The column is readable by the same roles that already read the table.

3. Notes
- The column is optional. The admin UI will show it when present and omit it when blank.
- No indexes needed — the column is display-only, not queried for filtering.
*/

ALTER TABLE approved_domains
  ADD COLUMN IF NOT EXISTS organization_name text;
