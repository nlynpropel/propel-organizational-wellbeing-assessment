/*
# Create notes table (multi-user, owner-scoped)

1. Purpose
- Stores personal notes for each authenticated user.
- Each user can only see, create, edit, and delete their own notes.

2. New Tables
- `notes`
  - `id` (uuid, primary key, auto-generated)
  - `title` (text, not null) — the note heading
  - `content` (text, not null, default empty string) — the note body
  - `user_id` (uuid, not null, defaults to the authenticated user) — owner reference
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now()) — refreshed on every update

3. Reusable Function
- `set_updated_at()` — a generic trigger function that sets NEW.updated_at to
  now(). Defined once so any future table's BEFORE UPDATE trigger can use it.

4. Indexes
- `idx_notes_user_id` on `user_id` for fast per-user listing.
- `idx_notes_updated_at` on `updated_at DESC` for ordering by recency.

5. Security
- Row Level Security ENABLED on `notes`.
- Four owner-scoped policies (SELECT / INSERT / UPDATE / DELETE), each scoped
  to `authenticated` users and gated by `auth.uid() = user_id`.
- `user_id` defaults to `auth.uid()` so client inserts that omit `user_id`
  still satisfy the INSERT policy's WITH CHECK.

6. Important Notes
1) This app has a sign-in screen, so policies are scoped to `authenticated`.
   An anonymous (signed-out) client cannot read or write any notes.
2) The `updated_at` column is refreshed via a BEFORE UPDATE trigger so the
   client never needs to send it manually.
3) All statements are idempotent — safe to re-run if the migration call times
   out after the SQL has already committed server-side.
*/

-- Generic updated_at trigger function (reusable across tables).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes"
  ON notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes"
  ON notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_notes_set_updated_at ON notes;
CREATE TRIGGER trg_notes_set_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
