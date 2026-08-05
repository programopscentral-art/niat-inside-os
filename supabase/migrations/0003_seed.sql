-- =====================================================================
-- NIAT Inside OS — 0003 seed (config + capability defaults)
-- Idempotent.
-- =====================================================================

insert into app_config (id, allowed_domain, admin_emails)
values (1, 'nxtwave.co.in', array['nalamasa.sanjay@nxtwave.co.in'])
on conflict (id) do update
  set allowed_domain = excluded.allowed_domain,
      admin_emails   = excluded.admin_emails,
      updated_at     = now();

insert into role_capabilities (team_role, caps) values
  ('manager', array[
     'VIEW_TEAM','CREATE_TASK','ASSIGN_TASK','EDIT_OWN_TASK','EDIT_ANY_TASK',
     'CLOSE_TASK','DELETE_TASK','COMMENT','SEND_EMAIL','MANAGE_MEMBERS',
     'APPROVE_JOIN','MANAGE_TEAM']),
  ('lead', array[
     'VIEW_TEAM','CREATE_TASK','ASSIGN_TASK','EDIT_OWN_TASK','EDIT_ANY_TASK',
     'CLOSE_TASK','COMMENT','SEND_EMAIL']),
  ('member', array[
     'VIEW_TEAM','CREATE_TASK','EDIT_OWN_TASK','COMMENT','SEND_EMAIL']),
  ('viewer', array[
     'VIEW_TEAM','COMMENT'])
on conflict (team_role) do update set caps = excluded.caps;
