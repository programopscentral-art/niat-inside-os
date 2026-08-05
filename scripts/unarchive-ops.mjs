import { readFileSync } from 'node:fs';
import pg from 'pg';
const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {}; for (const l of txt.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const c = new pg.Client({ connectionString: env.SUPABASE_POOL_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query("update teams set status='active' where team_key='OPS' returning team_key, status");
console.table(r.rows);
await c.end();
