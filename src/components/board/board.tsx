'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, AlertCircle, CalendarClock, GripVertical, Sheet } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/ui/avatar';
import { PriorityBadge } from '@/components/ui/badges';
import { Realtime } from '@/components/realtime';
import { updateTask } from '@/lib/actions/tasks';
import { BOARD_COLUMNS, STATUS_META, type Task, type TaskStatus } from '@/lib/types';
import { isOverdue, cn } from '@/lib/utils';

type Assignee = { full_name: string | null; email: string; avatar_url: string | null };

export function Board({ tasks: initial, assignees, caps, currentUserId, teamId }:
  { tasks: Task[]; assignees: Record<string, Assignee>; caps: string[]; currentUserId: string; teamId: string }) {
  const [tasks, setTasks] = useState(initial);
  // Reconcile with fresh server data after any router.refresh() (realtime).
  useEffect(() => { setTasks(initial); }, [initial]);
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const has = (c: string) => caps.includes(c);

  function canMove(task: Task, to: TaskStatus) {
    if (to === 'DONE' || to === 'CANCELLED') { if (!has('CLOSE_TASK')) return false; }
    if (has('EDIT_ANY_TASK')) return true;
    return has('EDIT_OWN_TASK') && (task.created_by === currentUserId || task.assignee_id === currentUserId);
  }

  const filtered = useMemo(() => tasks.filter((t) => {
    if (q && !(`${t.tag} ${t.title}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (priority && t.priority !== priority) return false;
    if (mineOnly && t.assignee_id !== currentUserId) return false;
    return true;
  }), [tasks, q, priority, mineOnly, currentUserId]);

  async function drop(status: TaskStatus) {
    const id = dragId; setDragId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    if (!canMove(task, status)) { toast('You don’t have permission to move this task there.', 'error'); return; }

    const prev = tasks;
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status, progress: status === 'DONE' ? 100 : t.progress } : t));
    const r = await updateTask(id, { status });
    if (!r.ok) { setTasks(prev); toast(r.error, 'error'); } else { router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <Realtime channel={`board:${teamId}`} subs={[{ table: 'tasks', filter: `team_id=eq.${teamId}` }]} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input className="input pl-9" placeholder="Filter by tag or title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="chip cursor-pointer select-none" onClick={() => setMineOnly((v) => !v)}
          style={mineOnly ? { background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' } : undefined}>
          <input type="checkbox" className="hidden" readOnly checked={mineOnly} /> Assigned to me
        </label>
      </div>

      <div className="grid gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(260px,1fr)] grid-flow-col lg:grid-flow-row lg:grid-cols-5">
        {BOARD_COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col);
          const meta = STATUS_META[col];
          return (
            <div key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(col)}
              className="flex min-h-24 flex-col rounded-lg border border-border bg-surface-2/50 p-2">
              <div className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold" style={{ color: meta.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                {meta.label}
                <span className="ml-auto rounded-full bg-muted px-1.5 text-fg-muted">{colTasks.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {colTasks.map((t) => {
                  const a = t.assignee_id ? assignees[t.assignee_id] : null;
                  const overdue = isOverdue(t.due_date, t.status);
                  const movable = canMove(t, 'IN_PROGRESS') || has('EDIT_ANY_TASK') || has('EDIT_OWN_TASK');
                  return (
                    <div key={t.id}
                      draggable={movable}
                      onDragStart={() => setDragId(t.id)}
                      onClick={() => router.push(`/tasks/${t.tag}`)}
                      className={cn('card group cursor-pointer p-3 transition-all hover:shadow-soft', dragId === t.id && 'opacity-50')}>
                      <div className="flex items-center gap-1.5">
                        {movable && <GripVertical className="h-3.5 w-3.5 text-fg-muted opacity-0 group-hover:opacity-100" />}
                        <span className="font-mono text-[11px] font-semibold text-primary">{t.tag}</span>
                        <div className="ml-auto flex items-center gap-1.5">
                          {t.sheet_url && <Sheet className="h-3 w-3" style={{ color: 'hsl(152 58% 42%)' }} />}
                          <PriorityBadge priority={t.priority} />
                        </div>
                      </div>
                      <div className="mt-1.5 text-sm font-medium leading-snug line-clamp-2">{t.title}</div>
                      {t.progress > 0 && t.status !== 'DONE' && (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${t.progress}%`, background: 'hsl(var(--primary))' }} />
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
                        {t.due_date && (
                          <span className={cn('inline-flex items-center gap-1', overdue && 'text-danger font-medium')}>
                            {overdue ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                            {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <div className="ml-auto">{a && <Avatar name={a.full_name} email={a.email} src={a.avatar_url} size={22} />}</div>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && <div className="grid place-items-center rounded-md border border-dashed border-border py-6 text-xs text-fg-muted">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
