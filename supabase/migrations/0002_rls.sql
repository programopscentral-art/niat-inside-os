-- =====================================================================
-- NIAT Inside OS — 0002 Row-Level Security & auth wiring
-- Enable RLS on every table (deny by default) and add explicit policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Domain lock + auto-provision profile on first login.
-- Runs on auth.users insert. Rejects any email outside the allowed domain
-- and stamps super_admin for allow-listed addresses.
-- ---------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_admins text[];
  v_email  text := lower(new.email);
begin
  select allowed_domain, admin_emails into v_domain, v_admins from app_config where id = 1;

  if split_part(v_email, '@', 2) <> lower(v_domain) then
    raise exception 'Access restricted to @% accounts', v_domain
      using errcode = 'insufficient_privilege';
  end if;

  insert into profiles (id, email, full_name, avatar_url, global_role, last_login_at)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when v_email = any(select lower(unnest(v_admins))) then 'super_admin'::global_role
         else 'user'::global_role end,
    now()
  )
  on conflict (id) do update set last_login_at = now();

  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Prevent privilege escalation: only super admins may change role/status.
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin()
     and (new.global_role is distinct from old.global_role
          or new.status is distinct from old.status) then
    raise exception 'Not allowed to change role or status';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile on profiles;
create trigger trg_guard_profile before update on profiles
  for each row execute function guard_profile_update();

-- Safe, minimal view of profiles for pickers.
create or replace view profiles_public as
  select id, email, full_name, avatar_url from profiles where status = 'active';

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table app_config        enable row level security;
alter table role_capabilities enable row level security;
alter table profiles          enable row level security;
alter table teams             enable row level security;
alter table team_members      enable row level security;
alter table join_requests     enable row level security;
alter table team_counters     enable row level security;
alter table tasks             enable row level security;
alter table task_watchers     enable row level security;
alter table comments          enable row level security;
alter table mentions          enable row level security;
alter table notifications     enable row level security;
alter table email_outbox      enable row level security;
alter table audit_log         enable row level security;

-- Helper to (re)create a policy cleanly.
-- (Postgres has no CREATE POLICY IF NOT EXISTS, so we drop first.)

-- app_config: readable by any authenticated user; writable only by admin.
drop policy if exists cfg_read on app_config;
create policy cfg_read on app_config for select to authenticated using (true);
drop policy if exists cfg_write on app_config;
create policy cfg_write on app_config for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- role_capabilities: read to authenticated; write admin only.
drop policy if exists rc_read on role_capabilities;
create policy rc_read on role_capabilities for select to authenticated using (true);
drop policy if exists rc_write on role_capabilities;
create policy rc_write on role_capabilities for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- profiles: any authenticated user can read (needed for pickers); update own row.
drop policy if exists prof_read on profiles;
create policy prof_read on profiles for select to authenticated using (true);
drop policy if exists prof_update_own on profiles;
create policy prof_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- teams: browse-to-join = any authenticated user can read; writes admin/manager.
drop policy if exists teams_read on teams;
create policy teams_read on teams for select to authenticated using (true);
drop policy if exists teams_insert on teams;
create policy teams_insert on teams for insert to authenticated
  with check (is_super_admin());
drop policy if exists teams_update on teams;
create policy teams_update on teams for update to authenticated
  using (is_super_admin() or has_cap(id, 'MANAGE_TEAM'))
  with check (is_super_admin() or has_cap(id, 'MANAGE_TEAM'));
drop policy if exists teams_delete on teams;
create policy teams_delete on teams for delete to authenticated
  using (is_super_admin());

-- team_members: visible to team members / self / admin; managed by MANAGE_MEMBERS.
drop policy if exists tm_read on team_members;
create policy tm_read on team_members for select to authenticated
  using (is_super_admin() or user_id = auth.uid() or is_member(team_id));
drop policy if exists tm_write on team_members;
create policy tm_write on team_members for all to authenticated
  using (is_super_admin() or has_cap(team_id, 'MANAGE_MEMBERS'))
  with check (is_super_admin() or has_cap(team_id, 'MANAGE_MEMBERS'));

-- join_requests: requester sees own; approvers see team's; requester can create.
drop policy if exists jr_read on join_requests;
create policy jr_read on join_requests for select to authenticated
  using (user_id = auth.uid() or is_super_admin() or has_cap(team_id, 'APPROVE_JOIN'));
drop policy if exists jr_insert on join_requests;
create policy jr_insert on join_requests for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists jr_update on join_requests;
create policy jr_update on join_requests for update to authenticated
  using (is_super_admin() or has_cap(team_id, 'APPROVE_JOIN'))
  with check (is_super_admin() or has_cap(team_id, 'APPROVE_JOIN'));

-- team_counters: no client access (RLS on, zero policies = deny). Triggers use
-- SECURITY DEFINER so numbering still works.

-- tasks: THE isolation boundary.
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks for select to authenticated
  using (can_view_task(id));
drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks for insert to authenticated
  with check (has_cap(team_id, 'CREATE_TASK'));
drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks for update to authenticated
  using (
    has_cap(team_id, 'EDIT_ANY_TASK')
    or (has_cap(team_id, 'EDIT_OWN_TASK') and auth.uid() in (created_by, assignee_id))
  )
  with check (
    has_cap(team_id, 'EDIT_ANY_TASK')
    or (has_cap(team_id, 'EDIT_OWN_TASK') and auth.uid() in (created_by, assignee_id))
  );
drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks for delete to authenticated
  using (has_cap(team_id, 'DELETE_TASK'));

-- task_watchers: readable if you can see the task; managed by ASSIGN_TASK/creator.
drop policy if exists w_read on task_watchers;
create policy w_read on task_watchers for select to authenticated
  using (can_view_task(task_id));
drop policy if exists w_write on task_watchers;
create policy w_write on task_watchers for all to authenticated
  using (
    exists (select 1 from tasks t where t.id = task_id
            and (has_cap(t.team_id, 'ASSIGN_TASK') or t.created_by = auth.uid()))
  )
  with check (
    exists (select 1 from tasks t where t.id = task_id
            and (has_cap(t.team_id, 'ASSIGN_TASK') or t.created_by = auth.uid()))
  );

-- comments: readable/insertable if you can view the task and may comment.
drop policy if exists c_read on comments;
create policy c_read on comments for select to authenticated
  using (can_view_task(task_id));
drop policy if exists c_insert on comments;
create policy c_insert on comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and can_view_task(task_id)
    and (has_cap(team_id, 'COMMENT') or is_watcher(task_id))
  );

-- mentions: readable if the parent task is viewable; inserts via service role.
drop policy if exists m_read on mentions;
create policy m_read on mentions for select to authenticated
  using (exists (select 1 from comments c where c.id = comment_id and can_view_task(c.task_id)));

-- notifications: strictly the recipient's own.
drop policy if exists n_rw on notifications;
create policy n_rw on notifications for all to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- email_outbox: RLS on, no policies -> client denied. Service role bypasses.

-- audit_log: managers read their team's audit; admin reads all. Insert via service role.
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select to authenticated
  using (is_super_admin() or (team_id is not null and has_cap(team_id, 'MANAGE_TEAM')));
