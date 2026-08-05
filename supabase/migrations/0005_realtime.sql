-- =====================================================================
-- NIAT Inside OS — 0005 realtime
-- Add tables to the supabase_realtime publication so the client receives
-- live INSERT/UPDATE/DELETE events (RLS still applies per subscriber).
-- REPLICA IDENTITY FULL lets client-side filters work on updates/deletes.
-- Idempotent.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['tasks','notifications','comments','join_requests','team_members','teams'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table tasks         replica identity full;
alter table notifications replica identity full;
alter table join_requests replica identity full;
alter table team_members  replica identity full;
alter table comments      replica identity full;
