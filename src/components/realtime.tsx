'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export interface Sub { table: string; filter?: string; }

/**
 * Drop-in live updater. Subscribes to Postgres changes (RLS-scoped) and calls
 * router.refresh() — which re-runs the current route's Server Components and
 * streams fresh data into the page without a full reload. Debounced so a burst
 * of changes triggers a single refresh.
 */
export function Realtime({ channel, subs }: { channel: string; subs: Sub[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = JSON.stringify(subs);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const ch = supabase.channel(`rt:${channel}`);
    for (const s of subs) {
      ch.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 250);
        }
      );
    }
    ch.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, key]);

  return null;
}
