-- =====================================================================
-- NIAT Inside OS — 0001 schema
-- Extensions, enums, tables, indexes, triggers, and security functions.
-- Idempotent: safe to run repeatedly.
-- =====================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;        -- fuzzy search on tags/titles

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type global_role as enum ('super_admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type team_role as enum ('manager', 'lead', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('OPEN','IN_PROGRESS','BLOCKED','IN_REVIEW','DONE','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('LOW','MEDIUM','HIGH','URGENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type join_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active','invited','removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type email_status as enum ('pending','sent','failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Config (single row) — domain lock + admin allow-list
-- ---------------------------------------------------------------------
create table if not exists app_config (
  id            int primary key default 1 check (id = 1),
  allowed_domain text not null default 'nxtwave.co.in',
  admin_emails  text[] not null default array['nalamasa.sanjay@nxtwave.co.in'],
  updated_at    timestamptz not null default now()
);

-- Capability defaults per team role.
create table if not exists role_capabilities (
  team_role team_role primary key,
  caps      text[] not null
);

-- ---------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  full_name    text,
  avatar_url   text,
  global_role  global_role not null default 'user',
  status       text not null default 'active' check (status in ('active','suspended')),
  created_at   timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  team_key    text unique not null check (team_key ~ '^[A-Z0-9]{2,8}$'),
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active','archived')),
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  team_role   team_role not null default 'member',
  permissions text[] not null default '{}',
  status      member_status not null default 'active',
  invited_by  uuid references profiles(id),
  joined_at   timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists idx_team_members_user on team_members(user_id) where status = 'active';
create index if not exists idx_team_members_team on team_members(team_id) where status = 'active';

create table if not exists join_requests (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  message      text,
  status       join_status not null default 'pending',
  decided_by   uuid references profiles(id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists uq_join_pending
  on join_requests(team_id, user_id) where status = 'pending';

create table if not exists team_counters (
  team_id  uuid primary key references teams(id) on delete cascade,
  last_seq int not null default 0
);

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  seq           int not null,
  tag           text not null unique,
  title         text not null,
  description   text,
  status        task_status not null default 'OPEN',
  priority      task_priority not null default 'MEDIUM',
  progress      int not null default 0 check (progress between 0 and 100),
  assignee_id   uuid references profiles(id),
  labels        text[] not null default '{}',
  due_date      date,
  remarks       text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_id, seq)
);
create index if not exists idx_tasks_team_status on tasks(team_id, status);
create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_tasks_due on tasks(due_date) where status <> 'DONE' and status <> 'CANCELLED';
create index if not exists idx_tasks_search on tasks using gin ((title || ' ' || tag || ' ' || coalesce(description,'')) gin_trgm_ops);

create table if not exists task_watchers (
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  added_by   uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists idx_watchers_user on task_watchers(user_id);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete cascade,
  author_id  uuid references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_task on comments(task_id, created_at);

create table if not exists mentions (
  id                uuid primary key default gen_random_uuid(),
  comment_id        uuid not null references comments(id) on delete cascade,
  mentioned_user_id uuid not null references profiles(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text,
  task_id       uuid references tasks(id) on delete set null,
  team_id       uuid references teams(id) on delete set null,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_notifs_recipient on notifications(recipient_id, is_read, created_at desc);

create table if not exists email_outbox (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  subject         text,
  html            text,
  status          email_status not null default 'pending',
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index if not exists idx_outbox_status on email_outbox(status, created_at);

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  ts          timestamptz not null default now(),
  actor_id    uuid references profiles(id),
  action      text not null,
  entity_type text,
  entity_id   text,
  team_id     uuid,
  details     jsonb
);
create index if not exists idx_audit_team on audit_log(team_id, ts desc);

-- ---------------------------------------------------------------------
-- updated_at trigger for tasks
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tasks_updated on tasks;
create trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Per-team ticket numbering: create counter when a team is created,
-- and assign seq + tag on task insert (atomic under concurrency).
-- ---------------------------------------------------------------------
create or replace function on_team_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_counters(team_id, last_seq) values (new.id, 0)
  on conflict (team_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_team_counter on teams;
create trigger trg_team_counter after insert on teams
  for each row execute function on_team_created();

create or replace function assign_task_tag() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seq int;
  v_key text;
begin
  insert into team_counters(team_id, last_seq) values (new.team_id, 0)
    on conflict (team_id) do nothing;
  update team_counters set last_seq = last_seq + 1
    where team_id = new.team_id
    returning last_seq into v_seq;
  select team_key into v_key from teams where id = new.team_id;
  new.seq := v_seq;
  new.tag := v_key || '-' || v_seq;
  return new;
end $$;

drop trigger if exists trg_task_tag on tasks;
create trigger trg_task_tag before insert on tasks
  for each row execute function assign_task_tag();

-- ---------------------------------------------------------------------
-- Security helper functions (SECURITY DEFINER -> bypass RLS internally,
-- so policies that call them never recurse).
-- ---------------------------------------------------------------------
create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and global_role = 'super_admin' and status = 'active'
  );
$$;

create or replace function is_member(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where team_id = p_team and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function is_watcher(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from task_watchers where task_id = p_task and user_id = auth.uid()
  );
$$;

-- Effective capability check: super admin -> always true; otherwise the cap
-- must be in (role defaults UNION granted extra permissions) for the user's
-- active membership of that team.
create or replace function has_cap(p_team uuid, p_cap text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role team_role;
  v_perms text[];
  v_defaults text[];
begin
  if is_super_admin() then
    return true;
  end if;

  select team_role, permissions into v_role, v_perms
  from team_members
  where team_id = p_team and user_id = auth.uid() and status = 'active';

  if v_role is null then
    return false;
  end if;

  select caps into v_defaults from role_capabilities where team_role = v_role;

  return p_cap = any(coalesce(v_defaults, '{}')) or p_cap = any(coalesce(v_perms, '{}'));
end $$;

-- Can the current user see this task at all? (team member, watcher, or admin)
create or replace function can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin()
      or is_watcher(p_task)
      or exists (
        select 1 from tasks t
        where t.id = p_task and is_member(t.team_id)
      );
$$;
