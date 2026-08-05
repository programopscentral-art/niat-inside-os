import { GitCommitHorizontal } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export interface ActivityRow {
  ts: string;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  details: Record<string, any> | null;
}

function describe(row: ActivityRow): string {
  const d = row.details || {};
  switch (row.action) {
    case 'task.create': return 'created this ticket';
    case 'task.assign': return `assigned it to ${d.assignee ?? 'someone'}`;
    case 'task.watch': return `tagged ${d.email ?? 'someone'}`;
    case 'comment.add': return 'commented';
    case 'task.update': {
      const parts: string[] = [];
      if (d.status) parts.push(`moved to ${d.status}`);
      if (d.priority) parts.push(`set priority ${d.priority}`);
      if (typeof d.progress === 'number') parts.push(`progress ${d.progress}%`);
      if ('due_date' in d) parts.push(d.due_date ? `due ${d.due_date}` : 'cleared the due date');
      if ('remarks' in d) parts.push('updated remarks');
      if (d.title) parts.push('renamed it');
      if (d.labels) parts.push('updated labels');
      return parts.length ? parts.join(', ') : 'updated the ticket';
    }
    default: return row.action.replace(/[._]/g, ' ');
  }
}

export function ActivityTimeline({ items }: { items: ActivityRow[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">History</h2>
      <ol className="relative ml-2 space-y-3 border-l border-border pl-5">
        {items.map((row, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[26px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-surface ring-1 ring-border">
              <GitCommitHorizontal className="h-3 w-3 text-fg-muted" />
            </span>
            <div className="text-sm">
              <span className="font-medium">{row.actor_name || row.actor_email || 'Someone'}</span>{' '}
              <span className="text-fg-muted">{describe(row)}</span>
            </div>
            <div className="text-xs text-fg-muted">{timeAgo(row.ts)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
