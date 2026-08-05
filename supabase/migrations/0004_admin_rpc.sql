-- =====================================================================
-- NIAT Inside OS — 0004 admin RPCs
-- Privileged operations that RLS intentionally forbids for normal rows.
-- Each re-checks is_super_admin() (based on the caller's auth.uid()).
-- =====================================================================

create or replace function admin_set_global_role(p_user uuid, p_role global_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  update profiles set global_role = p_role where id = p_user;
end $$;

create or replace function admin_set_user_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'bad status'; end if;
  update profiles set status = p_status where id = p_user;
end $$;

-- Cross-team analytics for the admin dashboard (admin only).
create or replace function admin_task_stats()
returns table(status task_status, count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select t.status, count(*)::bigint from tasks t group by t.status;
end $$;
