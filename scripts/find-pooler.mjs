import { readFileSync } from 'node:fs';
import pg from 'pg';

const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const l of txt.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }

const ref = env.SUPABASE_PROJECT_REF;
const pwd = env.SUPABASE_DB_PASSWORD;
const regions = ['ap-south-1','ap-southeast-1','us-east-1','us-east-2','us-west-1','eu-west-1','eu-west-2','eu-central-1','ap-southeast-2','ap-northeast-1','ap-northeast-2','sa-east-1','ca-central-1'];

for (const r of regions) {
  for (const prefix of ['aws-0','aws-1']) {
    const host = `${prefix}-${r}.pooler.supabase.com`;
    const conn = `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@${host}:5432/postgres`;
    const c = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000 });
    try {
      await c.connect();
      await c.query('select 1');
      console.log('MATCH ' + host + ':5432');
      await c.end();
      process.exit(0);
    } catch (e) {
      // console.log('x ' + host + ' ' + e.message);
      try { await c.end(); } catch {}
    }
  }
}
console.log('NO_MATCH');
process.exit(2);
