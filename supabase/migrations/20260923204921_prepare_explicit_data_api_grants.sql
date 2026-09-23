-- Prepare the Organizational Wellbeing Assessment for Supabase's October 30,
-- 2026 Data API grant change. Preserve current effective table access, then
-- stop relying on automatic grants for future public tables.

do $$
declare
  r record;
begin
  -- Preserve the current API reachability of existing public tables across
  -- branch creation and database resets. RLS continues to control row access.
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'grant select, insert, update, delete on table public.%I to anon, authenticated, service_role',
      r.tablename
    );
  end loop;
end
$$;

-- Preserve sequence access required by identity/serial-backed inserts when a
-- database is rebuilt from migrations.
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Opt in now to the safer post-Oct-30 behavior for tables created by migrations.
-- Every future CREATE TABLE in public must include explicit role grants.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
