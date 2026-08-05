-- =====================================================================
-- NIAT Inside OS — 0007 SLA / deadline sweep (in-database, via pg_cron)
-- Runs daily 08:00 IST (02:30 UTC). Creates in-app notifications for:
--   • due-soon / overdue open tasks -> assignee + watchers
--   • overdue HIGH/URGENT tasks     -> escalate to team managers/leads
-- Idempotent per day (guards against duplicate notifications on re-run).
-- Pure SQL so it needs NO edge-function deploy — it just works once scheduled.
-- =====================================================================

create extension if not exists pg_cron;

create or replace function run_deadline_sweep()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select t.id, t.tag, t.title, t.due_date, t.team_id, t.assignee_id, t.priority
    from tasks t
    where t.status not in ('DONE', 'CANCELLED')
      and t.due_date is not null
      and t.due_date <= (current_date + 1)
  loop
    -- Assignee reminder (once per day per task).
    if r.assignee_id is not null then
      insert into notifications (recipient_id, type, title, body, task_id, team_id)
      select r.assignee_id, 'deadline',
        (case when r.due_date < current_date then 'Overdue: ' else 'Due soon: ' end) || r.tag,
        r.title || ' — due ' || r.due_date, r.id, r.team_id
      where not exists (
        select 1 from notifications n
        where n.recipient_id = r.assignee_id and n.task_id = r.id
          and n.type = 'deadline' and n.created_at::date = current_date);
    end if;

    -- Watcher reminders.
    insert into notifications (recipient_id, type, title, body, task_id, team_id)
    select w.user_id, 'deadline',
      (case when r.due_date < current_date then 'Overdue: ' else 'Due soon: ' end) || r.tag,
      r.title || ' — due ' || r.due_date, r.id, r.team_id
    from task_watchers w
    where w.task_id = r.id and w.user_id is distinct from r.assignee_id
      and not exists (
        select 1 from notifications n
        where n.recipient_id = w.user_id and n.task_id = r.id
          and n.type = 'deadline' and n.created_at::date = current_date);

    -- Escalate overdue HIGH/URGENT to managers & leads.
    if r.due_date < current_date and r.priority in ('HIGH', 'URGENT') then
      insert into notifications (recipient_id, type, title, body, task_id, team_id)
      select m.user_id, 'escalation',
        'Escalation: ' || r.tag || ' overdue (' || r.priority || ')',
        r.title || ' is overdue and still open.', r.id, r.team_id
      from team_members m
      where m.team_id = r.team_id and m.status = 'active' and m.team_role in ('manager', 'lead')
        and not exists (
          select 1 from notifications n
          where n.recipient_id = m.user_id and n.task_id = r.id
            and n.type = 'escalation' and n.created_at::date = current_date);
    end if;
  end loop;
end $$;

-- (Re)schedule the daily job.
do $$ begin perform cron.unschedule('deadline-sweep'); exception when others then null; end $$;
select cron.schedule('deadline-sweep', '30 2 * * *', 'select run_deadline_sweep();');
