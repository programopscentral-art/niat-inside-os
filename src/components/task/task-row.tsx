import Link from 'next/link';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { StatusBadge, PriorityBadge, TeamKeyBadge } from '@/components/ui/badges';
import { Avatar } from '@/components/ui/avatar';
import { isOverdue } from '@/lib/utils';
import type { Task } from '@/lib/types';

export function TaskRow({ task, assignee }: { task: Task; assignee?: { full_name: string | null; email: string; avatar_url: string | null } | null }) {
  const overdue = isOverdue(task.due_date, task.status);
  return (
    <Link href={`/tasks/${task.tag}`}
      className="card flex items-center gap-3 p-3 transition-all hover:shadow-soft hover:-translate-y-0.5">
      <TeamKeyBadge k={task.tag} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{task.title}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
          {task.due_date && (
            <span className={overdue ? 'text-danger font-medium inline-flex items-center gap-1' : 'inline-flex items-center gap-1'}>
              {overdue ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {task.progress > 0 && task.status !== 'DONE' && <span>{task.progress}%</span>}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
      <StatusBadge status={task.status} />
      {assignee && <Avatar name={assignee.full_name} email={assignee.email} src={assignee.avatar_url} size={26} />}
    </Link>
  );
}
