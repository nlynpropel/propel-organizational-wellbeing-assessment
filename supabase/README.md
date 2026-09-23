# Supabase migration rules

Supabase no longer auto-exposes new `public` tables to the Data API. Treat table grants and RLS as two separate requirements.

For every migration that creates a table in `public`:

1. Enable RLS in the same migration.
2. Explicitly grant only the Data API roles that need the table.
3. Add matching RLS policies for `anon` and/or `authenticated`.
4. Grant `service_role` explicitly when server-side Supabase clients need the table.
5. Do not grant `anon` by default. Use it only for an intentional unauthenticated workflow.
6. If the table uses a sequence/serial identity and client roles insert directly, grant the required sequence permissions.
7. Verify the intended role can reach the table and that RLS still limits rows correctly.

Typical authenticated-only table:

```sql
create table public.example (...);

alter table public.example enable row level security;

grant select, insert, update, delete
on table public.example
to authenticated, service_role;

-- Add least-privilege RLS policies here.
```

Public/anonymous access must be explicitly justified and granted in the migration rather than inherited from database defaults.
