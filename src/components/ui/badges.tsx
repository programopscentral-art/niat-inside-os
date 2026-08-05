import { STATUS_META, PRIORITY_META, type TaskStatus, type TaskPriority } from '@/lib/types';
import { ROLE_LABELS, type TeamRole } from '@/lib/capabilities';

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="chip" style={{ background: `${m.color}1a`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const m = PRIORITY_META[priority];
  return <span className="chip" style={{ background: `${m.color}1a`, color: m.color }}>{m.label}</span>;
}

export function RoleBadge({ role }: { role: TeamRole }) {
  return <span className="chip">{ROLE_LABELS[role]}</span>;
}

export function TeamKeyBadge({ k }: { k: string }) {
  return (
    <span className="chip font-mono font-semibold" style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
      {k}
    </span>
  );
}
