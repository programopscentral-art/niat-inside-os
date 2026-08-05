-- =====================================================================
-- NIAT Inside OS — 0006 task activity timeline
-- A SECURITY DEFINER function that returns the audit trail for one task to
-- anyone allowed to view that task (RLS on audit_log stays manager/admin-only
-- for the global log; this exposes only a single task's events).
-- =====================================================================

create or replace function task_activity(p_task uuid)
returns table(ts timestamptz, actor_email text, actor_name text, action text, details jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_view_task(p_task) then
    raise exception 'not allowed';
  end if;
  return query
    select a.ts, p.email, p.full_name, a.action, a.details
    from audit_log a
    left join profiles p on p.id = a.actor_id
    where a.entity_type = 'task' and a.entity_id = p_task::text
    order by a.ts asc;
end $$;
