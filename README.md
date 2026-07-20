# Propel Well-being Opportunity Index

An application for **employee-benefits brokers** to create organizational well-being
assessments, send secure assessment links to employer clients, and review client-ready reports
with maturity scoring and practical recommendations.

## Product purpose

Brokers use Propel to:

1. Create an employer client profile
2. Generate a secure, no-account assessment link
3. Send the link to the client contact
4. Track assessment status (draft → sent → opened → submitted → report ready)
5. Review results — overall Opportunity Index, maturity classification, six strategy
   dimensions, four behavioral-readiness drivers, strengths, priority opportunities
6. Download a client-ready PDF report

Clients complete the assessment without creating an account, via a unique tokenized link.

## Supabase connection

The app uses the **existing, pre-connected Supabase project** (project ref
`bslflrnwlkatoclcapfl`) as its database and authentication provider. No new Supabase project
was created.

### Authentication

Supabase Auth is the authentication provider. Two flows are wired:

- **Magic link (primary):** the `/login` page calls `supabase.auth.signInWithOtp` with
  `emailRedirectTo` pointing to `/auth/callback`.
- **Email/password (preserved):** the original `signUp` / `signInWithPassword` methods remain
  in `AuthContext`.

A database trigger (`on_auth_user_created`) automatically creates a `profiles` row when a new
auth user signs up. New profiles default to `role='broker'`, `status='invited'`. An admin must
set `status='active'` before dashboard access is granted.

### Authorization

Authentication and authorization are separate:

- **Authentication** = Supabase Auth session (who you are)
- **Authorization** = `profiles` row with `role` + `status` (what you can do)

Protected routes require: a valid session + an active profile (`status='active'`) with
`role='broker'` or `role='admin'`. RLS is the actual data-security boundary — the frontend
guard is a convenience layer on top.

## Database schema

Five production tables (plus the original `notes` table, preserved):

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | One row per auth user. Carries role (admin/broker) + status. | Enabled |
| `organizations` | Employer clients owned by a broker. | Enabled |
| `assessment_versions` | Assessment questionnaire versions (foundation only). | Enabled |
| `assessment_instances` | A specific assessment sent to an organization. | Enabled |
| `broker_notes` | Notes a broker attaches to an organization. | Enabled |

### RLS policies

- **profiles**: brokers read/update own profile (cannot change role/status/id); admins manage all.
- **organizations**: active brokers CRUD own organizations; admins access all.
- **assessment_versions**: active brokers read published only; admins manage all.
- **assessment_instances**: active brokers CRUD own instances; admins access all. No public access yet.
- **broker_notes**: active brokers CRUD own notes; admins access all.

Reusable helper functions: `is_active_admin()`, `is_active_broker()`, `is_active_user()`.

### Updated-at behavior

A reusable `set_updated_at()` trigger function applies to `profiles`, `organizations`,
`broker_notes`, and `notes`.

## Data-access architecture

Service layer in `src/services/`:

- `profiles.ts` — fetch profile, update own profile, broker count
- `organizations.ts` — fetch/create/archive organizations with nested assessment data
- `assessments.ts` — fetch assessments, create draft, count by status, fetch reports ready
- `brokerNotes.ts` — CRUD for broker notes

Database row types in `src/lib/database.types.ts`.

## Route structure

### Public

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` | Magic-link login |
| `/auth/callback` | OAuth callback handler |
| `/assessment/:token` | Public assessment placeholder (no questions yet) |

### Authenticated broker (protected)

| Route | Purpose | Data source |
|-------|---------|-------------|
| `/dashboard` | Metrics + client table | **Supabase** |
| `/clients` | Client directory + archive toggle | **Supabase** |
| `/clients/new` | New client form → inserts org + draft assessment | **Supabase** |
| `/clients/:id` | Client detail with tabs | **Supabase** (scores placeholder) |
| `/clients/:id/results` | Results page | **Supabase** (scores placeholder) |
| `/assessments` | Assessment tracking | **Supabase** |
| `/reports` | Report cards | **Supabase** |
| `/settings` | Profile + preferences | **Supabase** (profile) |
| `/admin` | Admin shell + real broker count | **Supabase** (broker count) |

## Pages using real Supabase data

- Dashboard, Clients, New Client, Client Detail, Assessments, Reports, Settings, Admin
- Broker notes (full CRUD)
- Authentication + profile-based access guard

## Pages still using placeholder data

- **Client Detail → scores**: strategy dimensions, behavioral readiness, recommendations
  (labeled "Placeholder data" in the UI)
- **Results page**: all scores, strengths, opportunities, quick wins, high-impact moves,
  meeting questions (labeled "Placeholder data")
- **Assessment placeholder** (`/assessment/:token`): organization name, broker name
- **PDF download, report regeneration, Propel Strategy Review**: all placeholders

## Existing notes-app elements still present

- `src/components/NotesApp.tsx` — preserved, not routed
- `src/components/AuthScreen.tsx` — preserved, not routed
- `src/lib/supabase.ts` — still exports `Note` type
- `notes` table + migration — preserved and unchanged

## Manual Supabase steps required

1. **Activate your first admin user:** After signing up (magic link or password), your
   profile will be created with `status='invited'`. Use the Supabase dashboard SQL editor
   or the `execute_sql` MCP tool to set yourself to admin + active:

   ```sql
   UPDATE profiles SET role = 'admin', status = 'active' WHERE email = 'your-email@example.com';
   ```

2. **Activate broker users:** Each new broker who signs up will be `invited`. Activate them:

   ```sql
   UPDATE profiles SET status = 'active' WHERE email = 'broker@example.com';
   ```

## Test setup

1. Sign up two broker users (Broker A and Broker B) via the magic-link flow.
2. Activate Broker A: `UPDATE profiles SET status = 'active' WHERE email = 'broker-a@example.com';`
3. Sign in as Broker A, create a client organization.
4. Sign in as Broker B (activate first) and verify they cannot see Broker A's organization.
5. Sign out and verify unauthenticated users cannot access `/dashboard`.
6. Create a third user, leave them as `invited`, and verify they see "Access pending."
7. Set a user to `suspended` and verify they see "Access restricted."

## Remaining implementation phases

1. **Assessment questionnaire** — build the question flow at `/assessment/:token`
2. **Scoring engine** — compute Opportunity Index, dimensions, behavioral drivers
3. **Recommendation engine** — select and rank from a recommendation bank
4. **Secure link generation** — real tokenized links with expiry via server-side function
5. **PDF report generation**
6. **Email invitations**
7. **Admin tools** — broker management, assessment versions, recommendation bank
8. **Public assessment access** — server-side function for unauthenticated token-based access
9. **Remove notes-app remnants** — delete `NotesApp.tsx`, `AuthScreen.tsx`, drop `notes` table
