// Applies every SQL file in supabase/migrations (in order) to the database.
// Reads the connection string from .env.local (SUPABASE_DB_URL).
// Usage: node scripts/db-apply.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const txt = readFileSync(join(root, '.env.local'), 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
// Prefer the IPv4 session-mode pooler; fall back to the direct URL.
const conn = process.env.SUPABASE_POOL_URL || env.SUPABASE_POOL_URL
  || process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
if (!conn) { console.error('SUPABASE_POOL_URL / SUPABASE_DB_URL missing'); process.exit(1); }

const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected. Applying %d migration(s)...', files.length);
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    process.stdout.write(`  → ${f} ... `);
    await client.query(sql);
    console.log('ok');
  }
  console.log('\nAll migrations applied successfully.');
} catch (e) {
  console.error('\nMigration failed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
