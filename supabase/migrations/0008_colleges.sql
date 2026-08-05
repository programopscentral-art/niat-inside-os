-- =====================================================================
-- NIAT Inside OS — 0008 colleges / university assignments
-- Each team keeps a directory of colleges/universities and the member who
-- takes care of each. Editable by super admins and anyone with the
-- MANAGE_COLLEGES capability (managers by default; grantable to others).
-- =====================================================================

create table if not exists colleges (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  name            text not null,
  city            text,
  caretaker_name  text,
  caretaker_email text,
  caretaker_phone text,
  designation     text,
  employee_id     text,
  status          text not null default 'active' check (status in ('active', 'on_hold', 'closed')),
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_colleges_team on colleges(team_id);
create index if not exists idx_colleges_caretaker on colleges(caretaker_email);

drop trigger if exists trg_colleges_updated on colleges;
create trigger trg_colleges_updated before update on colleges
  for each row execute function set_updated_at();

-- New capability so managers (and specifically-granted members) can edit.
update role_capabilities
  set caps = caps || array['MANAGE_COLLEGES']
  where team_role = 'manager' and not ('MANAGE_COLLEGES' = any(caps));

-- RLS
alter table colleges enable row level security;

drop policy if exists col_read on colleges;
create policy col_read on colleges for select to authenticated
  using (is_super_admin() or is_member(team_id));

drop policy if exists col_write on colleges;
create policy col_write on colleges for all to authenticated
  using (is_super_admin() or has_cap(team_id, 'MANAGE_COLLEGES'))
  with check (is_super_admin() or has_cap(team_id, 'MANAGE_COLLEGES'));

-- Realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='colleges') then
    execute 'alter publication supabase_realtime add table public.colleges';
  end if;
end $$;
alter table colleges replica identity full;
