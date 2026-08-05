'use client';
import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_ENV } from '../env';

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowser() {
  if (!client) {
    client = createBrowserClient(PUBLIC_ENV.SUPABASE_URL, PUBLIC_ENV.SUPABASE_ANON_KEY);
  }
  return client;
}
