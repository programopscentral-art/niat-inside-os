'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markRead, markAllRead } from '@/lib/actions/notifications';
import { timeAgo, cn } from '@/lib/utils';

interface Item { id: string; type: string; title: string; body: string | null; is_read: boolean; created_at: string; tag: string | null; }

export function NotificationsList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const unread = items.filter((i) => !i.is_read).length;

  function open(i: Item) {
    start(async () => {
      if (!i.is_read) await markRead(i.id);
      if (i.tag) router.push(`/tasks/${i.tag}`); else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={() => start(async () => { await markAllRead(); router.refresh(); })}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <div className="card grid place-items-center gap-2 p-12 text-center">
          <Bell className="h-8 w-8 text-fg-muted" />
          <p className="text-sm text-fg-muted">You’re all caught up.</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((i) => (
          <button key={i.id} onClick={() => open(i)}
            className={cn('card flex w-full items-start gap-3 p-3 text-left transition-all hover:shadow-soft', !i.is_read && 'ring-1 ring-primary/30')}>
            <div className="mt-1">{i.is_read ? <Circle className="h-2.5 w-2.5 text-transparent" /> : <span className="block h-2.5 w-2.5 rounded-full bg-primary" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{i.title}</span>
                <span className="shrink-0 text-xs text-fg-muted">{timeAgo(i.created_at)}</span>
              </div>
              {i.body && <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{i.body}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
