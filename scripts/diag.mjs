import { readFileSync } from 'node:fs';
import pg from 'pg';
const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {}; for (const l of txt.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const c = new pg.Client({ connectionString: env.SUPABASE_POOL_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const show = async (label, sql) => { const r = await c.query(sql); console.log('\n== ' + label + ' =='); console.table(r.rows); };
await show('profiles', `select email, global_role, status from profiles order by created_at`);
await show('teams', `select team_key, name, status, created_by from teams order by created_at`);
await show('team_members', `select t.team_key, p.email, m.team_role, m.status, array_length(m.permissions,1) as extra
  from team_members m join teams t on t.id=m.team_id join profiles p on p.id=m.user_id order by t.team_key`);
await show('join_requests', `select t.team_key, p.email, j.status from join_requests j join teams t on t.id=j.team_id join profiles p on p.id=j.user_id order by j.created_at`);
await show('app_config', `select allowed_domain, admin_emails from app_config`);
await show('realtime pub', `select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename`);
await c.end();
