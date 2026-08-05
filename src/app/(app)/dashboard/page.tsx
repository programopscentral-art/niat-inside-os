import Link from 'next/link';
import { ListTodo, PlusCircle, Users2, Inbox, ArrowRight } from 'lucide-react';
import { requireUser, getMyTeams } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { TaskRow } from '@/components/task/task-row';
import { TeamKeyBadge } from '@/components/ui/badges';
import type { Task } from '@/lib/types';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const teams = await getMyTeams();

  const [{ data: assigned }, { data: created }, { data: pending }] = await Promise.all([
    supabase.from('tasks').select('*').eq('assignee_id', user.id).not('status', 'in', '("DONE","CANCELLED")').order('due_date', { nullsFirst: false }).limit(8),
    supabase.from('tasks').select('*').eq('created_by', user.id).not('status', 'in', '("DONE","CANCELLED")').order('created_at', { ascending: false }).limit(6),
    supabase.from('join_requests').select('*, teams(name, team_key)').eq('status', 'pending').limit(10)
  ]);

  const pendingForMe = (pending ?? []).filter((r: any) => r.user_id !== user.id);
  const first = (user.profile.full_name || user.email).split(' ')[0].split('@')[0];

  const stats = [
    { label: 'Assigned to me', value: assigned?.length ?? 0, icon: ListTodo, href: '#assigned' },
    { label: 'Created by me', value: created?.length ?? 0, icon: PlusCircle, href: '#created' },
    { label: 'My teams', value: teams.length, icon: Users2, href: '/teams' },
    { label: 'Needs approval', value: pendingForMe.length, icon: Inbox, href: '#approvals' }
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, <span className="gradient-text">{first}</span> 👋</h1>
        <p className="mt-1 text-fg-muted">Here’s what needs your attention today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition-all hover:shadow-soft hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-primary" />
              <span className="text-2xl font-extrabold">{s.value}</span>
            </div>
            <div className="mt-2 text-sm text-fg-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      {pendingForMe.length > 0 && (
        <section id="approvals" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Pending join requests</h2>
          <div className="space-y-2">
            {pendingForMe.map((r: any) => (
              <Link key={r.id} href={`/teams/${r.teams?.team_key}/manage`} className="card flex items-center gap-3 p-3 hover:shadow-soft">
                <TeamKeyBadge k={r.teams?.team_key ?? '—'} />
                <span className="flex-1 text-sm">A user requested to join <b>{r.teams?.name}</b></span>
                <span className="chip">Review <ArrowRight className="h-3 w-3" /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section id="assigned" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Assigned to me</h2>
          </div>
          {assigned && assigned.length > 0 ? (
            <div className="space-y-2">{(assigned as Task[]).map((t) => <TaskRow key={t.id} task={t} />)}</div>
          ) : <EmptyState text="Nothing assigned to you. Enjoy the calm ☕" />}
        </section>

        <section id="created" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Created by me</h2>
          {created && created.length > 0 ? (
            <div className="space-y-2">{(created as Task[]).map((t) => <TaskRow key={t.id} task={t} />)}</div>
          ) : <EmptyState text="You haven’t created any open tasks." />}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="card grid place-items-center p-8 text-sm text-fg-muted">{text}</div>;
}
