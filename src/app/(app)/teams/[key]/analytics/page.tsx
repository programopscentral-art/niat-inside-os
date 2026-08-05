import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ListChecks, CircleDot, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requireUser, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { TeamKeyBadge } from '@/components/ui/badges';
import { Avatar } from '@/components/ui/avatar';
import { STATUS_META, PRIORITY_META, type TaskStatus, type TaskPriority } from '@/lib/types';
import { isOverdue } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: { params: { key: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const admin = isAdmin(user);

  const { data: team } = await supabase.from('teams').select('*').eq('team_key', params.key.toUpperCase()).maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from('team_members').select('id').eq('team_id', team.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (!membership && !admin) redirect(`/teams/${team.team_key}`);

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from('tasks').select('status, priority, due_date, assignee_id, created_at, updated_at').eq('team_id', team.id),
    supabase.from('team_members').select('user_id, profiles(email, full_name, avatar_url)').eq('team_id', team.id).eq('status', 'active')
  ]);

  const all = tasks ?? [];
  const openStates: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW'];
  const isOpen = (s: string) => openStates.includes(s as TaskStatus);

  const total = all.length;
  const open = all.filter((t) => isOpen(t.status)).length;
  const overdue = all.filter((t) => isOverdue(t.due_date, t.status)).length;
  const now = Date.now();
  const doneRecent = all.filter((t) => t.status === 'DONE' && now - new Date(t.updated_at).getTime() < 30 * 864e5).length;

  const statusCounts = (Object.keys(STATUS_META) as TaskStatus[]).map((s) => ({ s, n: all.filter((t) => t.status === s).length }));
  const priorityCounts = (Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => ({ p, n: all.filter((t) => t.priority === p && isOpen(t.status)).length }));

  // Workload = open tasks per member.
  const nameFor = new Map<string, any>();
  for (const m of members ?? []) nameFor.set((m as any).user_id, (m as any).profiles);
  const workload = new Map<string, number>();
  for (const t of all) if (isOpen(t.status) && t.assignee_id) workload.set(t.assignee_id, (workload.get(t.assignee_id) ?? 0) + 1);
  const unassignedOpen = all.filter((t) => isOpen(t.status) && !t.assignee_id).length;
  const workloadRows = [...workload.entries()].map(([id, n]) => ({ id, n, p: nameFor.get(id) })).sort((a, b) => b.n - a.n);
  const maxLoad = Math.max(1, ...workloadRows.map((w) => w.n), unassignedOpen);

  const tiles = [
    { label: 'Total tasks', value: total, icon: ListChecks, color: 'hsl(var(--primary))' },
    { label: 'Open', value: open, icon: CircleDot, color: STATUS_META.IN_PROGRESS.color },
    { label: 'Overdue', value: overdue, icon: AlertTriangle, color: STATUS_META.BLOCKED.color },
    { label: 'Done (30d)', value: doneRecent, icon: CheckCircle2, color: STATUS_META.DONE.color }
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/teams/${team.team_key}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back to board</Link>
      <div className="flex items-center gap-2">
        <TeamKeyBadge k={team.team_key} />
        <h1 className="text-2xl font-bold">{team.name} — Insights</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <div className="flex items-center justify-between">
              <t.icon className="h-5 w-5" style={{ color: t.color }} />
              <span className="text-2xl font-extrabold" style={{ color: t.color }}>{t.value}</span>
            </div>
            <div className="mt-2 text-sm text-fg-muted">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold">By status</h2>
          <div className="mt-4 space-y-2.5">
            {statusCounts.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-fg-muted">{STATUS_META[s].label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%`, background: STATUS_META[s].dot }} />
                </div>
                <span className="w-8 text-right font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold">Open by priority</h2>
          <div className="mt-4 space-y-2.5">
            {priorityCounts.map(({ p, n }) => (
              <div key={p} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-fg-muted">{PRIORITY_META[p].label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${open ? (n / open) * 100 : 0}%`, background: PRIORITY_META[p].color }} />
                </div>
                <span className="w-8 text-right font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">Workload — open tasks per person</h2>
        <div className="mt-4 space-y-2.5">
          {workloadRows.length === 0 && unassignedOpen === 0 && <p className="text-sm text-fg-muted">No open tasks. 🎉</p>}
          {workloadRows.map((w) => (
            <div key={w.id} className="flex items-center gap-3 text-sm">
              <span className="flex w-40 shrink-0 items-center gap-2">
                <Avatar name={w.p?.full_name} email={w.p?.email} src={w.p?.avatar_url} size={22} />
                <span className="truncate">{w.p?.full_name || w.p?.email || 'Unknown'}</span>
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(w.n / maxLoad) * 100}%`, background: 'hsl(var(--primary))' }} />
              </div>
              <span className="w-8 text-right font-medium">{w.n}</span>
            </div>
          ))}
          {unassignedOpen > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 text-fg-muted">Unassigned</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(unassignedOpen / maxLoad) * 100}%`, background: 'hsl(var(--fg-muted))' }} />
              </div>
              <span className="w-8 text-right font-medium">{unassignedOpen}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
