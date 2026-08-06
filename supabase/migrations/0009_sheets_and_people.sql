-- =====================================================================
-- NIAT Inside OS — 0009
--   • Google Sheet link on tasks and colleges
--   • college_people: multiple take-care persons per college
-- =====================================================================

alter table tasks    add column if not exists sheet_url text;
alter table colleges add column if not exists sheet_url text;

create table if not exists college_people (
  id           uuid primary key default gen_random_uuid(),
  college_id   uuid not null references colleges(id) on delete cascade,
  name         text not null,
  employee_id  text,
  mobile       text,
  email        text,
  designation  text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_college_people_college on college_people(college_id);

-- View/manage a college's people based on the parent college's team.
create or replace function can_view_college(p_college uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from colleges c where c.id = p_college and is_member(c.team_id));
$$;

create or replace function can_manage_college(p_college uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from colleges c where c.id = p_college and has_cap(c.team_id, 'MANAGE_COLLEGES'));
$$;

alter table college_people enable row level security;

drop policy if exists cp_read on college_people;
create policy cp_read on college_people for select to authenticated
  using (can_view_college(college_id));

drop policy if exists cp_write on college_people;
create policy cp_write on college_people for all to authenticated
  using (can_manage_college(college_id)) with check (can_manage_college(college_id));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='college_people') then
    execute 'alter publication supabase_realtime add table public.college_people';
  end if;
end $$;
alter table college_people replica identity full;
