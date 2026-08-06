'use client';
import { useMemo, useState } from 'react';
import { Search, Inbox } from 'lucide-react';
import { TaskRow } from '@/components/task/task-row';
import { RaiseTicketDialog, type RaiseTeam } from '@/components/task/raise-ticket-dialog';
import { TASK_STATUS_ALL } from '@/lib/board-const';
import type { Task } from '@/lib/types';

type Assignee = { full_name: string | null; email: string; avatar_url: string | null };
type Ticket = Task & { team_key?: string };

export function TicketsView({ tickets, assignees, teams, currentUserId }:
  { tickets: Ticket[]; assignees: Record<string, Assignee>; teams: RaiseTeam[]; currentUserId: string }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [teamKey, setTeamKey] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  const teamKeys = useMemo(() => [...new Set(tickets.map((t) => t.team_key).filter(Boolean))] as string[], [tickets]);

  const filtered = useMemo(() => tickets.filter((t) => {
    if (q && !`${t.tag} ${t.title}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status && t.status !== status) return false;
    if (teamKey && t.team_key !== teamKey) return false;
    if (mineOnly && t.assignee_id !== currentUserId) return false;
    return true;
  }), [tickets, q, status, teamKey, mineOnly, currentUserId]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="mt-1 text-fg-muted">Raise a ticket and track everything across your teams.</p>
        </div>
        <RaiseTicketDialog teams={teams} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input className="input pl-9" placeholder="Search tag or title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {TASK_STATUS_ALL.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {teamKeys.length > 1 && (
          <select className="input w-auto" value={teamKey} onChange={(e) => setTeamKey(e.target.value)}>
            <option value="">All teams</option>
            {teamKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
        <label className="chip cursor-pointer select-none" onClick={() => setMineOnly((v) => !v)}
          style={mineOnly ? { background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' } : undefined}>
          Assigned to me
        </label>
        <span className="ml-auto chip">{filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card grid place-items-center gap-2 p-12 text-center text-sm text-fg-muted">
          <Inbox className="h-8 w-8" />
          {tickets.length === 0 ? 'No tickets in your teams yet. Raise the first one.' : 'No tickets match your filters.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => <TaskRow key={t.id} task={t} assignee={t.assignee_id ? assignees[t.assignee_id] : null} />)}
        </div>
      )}
    </div>
  );
}
