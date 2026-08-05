import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PUBLIC_ENV } from '../env';

/**
 * RLS-scoped Supabase client for Server Components, Route Handlers and Server
 * Actions. Runs AS THE LOGGED-IN USER, so every query is filtered by RLS.
 */
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(PUBLIC_ENV.SUPABASE_URL, PUBLIC_ENV.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — cookies are read-only here.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      }
    }
  });
}
