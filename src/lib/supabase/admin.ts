import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '../env';

/**
 * Service-role client — BYPASSES RLS. Server-only. Use ONLY for privileged,
 * already-authorized operations (inserting notifications, adding a mentioned
 * cross-team watcher, writing audit/email rows). Never expose to the client
 * and never use it to skip an authorization check.
 */
export function createSupabaseAdmin() {
  const env = serverEnv();
  return createClient(env.SUPABASE_URL, env.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
