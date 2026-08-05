import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { requireUser, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { effectiveCaps, CAPS, type TeamRole } from '@/lib/capabilities';
import { StatusBadge, PriorityBadge, TeamKeyBadge } from '@/components/ui/badges';
import { Avatar } from '@/components/ui/avatar';
import { Markdown } from '@/components/ui/markdown';
import { TaskSidebar } from '@/components/task/task-sidebar';
import { AddComment } from '@/components/task/add-comment';
import { Realtime } from '@/components/realtime';
import { timeAgo } from '@/lib/utils';
import type { Task } from '@/lib/types';

export default async function TaskPage({ params }: { params: { tag: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const admin = isAdmin(user);

  const { data: task } = await supabase.from('tasks').select('*').eq('tag', params.tag.toUpperCase()).maybeSingle();
  if (!task) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted"><Lock className="h-6 w-6 text-fg-muted" /></div>
          <h1 className="mt-4 text-lg font-bold">Ticket not found</h1>
          <p className="mt-1 text-sm text-fg-muted">Either it doesn’t exist, or it belongs to a team you’re not part of.</p>
          <Link href="/dashboard" className="btn btn-outline btn-md mt-5">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  const t = task as Task;

  const [{ data: team }, { data: membership }, { data: watchersRows }, { data: comments }, { data: members }] = await Promise.all([
    supabase.from('teams').select('*').eq('id', t.team_id).single(),
    supabase.from('team_members').select('*').eq('team_id', t.team_id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabase.from('task_watchers').select('user_id').eq('task_id', t.id),
    supabase.from('comments').select('*').eq('task_id', t.id).order('created_at', { ascending: true }),
    supabase.from('team_members').select('user_id, profiles(email, full_name, avatar_url)').eq('team_id', t.team_id).eq('status', 'active')
  ]);

  // Caps: admin=all; member=role caps; watcher-only (cross-team)=comment.
  let caps: string[];
  if (admin) caps = [...CAPS];
  else if (membership) caps = [...effectiveCaps(membership.team_role as TeamRole, membership.permissions ?? [])];
  else caps = ['VIEW_TEAM', 'COMMENT'];

  // Resolve every profile we need in one query.
  const ids = new Set<string>();
  if (t.assignee_id) ids.add(t.assignee_id);
  if (t.created_by) ids.add(t.created_by);
  (watchersRows ?? []).forEach((w: any) => ids.add(w.user_id));
  (comments ?? []).forEach((c: any) => c.author_id && ids.add(c.author_id));
  const { data: people } = ids.size
    ? await supabase.from('profiles').select('id, email, full_name, avatar_url').in('id', [...ids])
    : { data: [] as any[] };
  const pmap: Record<string, any> = {};
  (people ?? []).forEach((p: any) => (pmap[p.id] = p));

  const assignee = t.assignee_id ? pmap[t.assignee_id] : null;
  const creator = t.created_by ? pmap[t.created_by] : null;
  const watchers = (watchersRows ?? []).map((w: any) => pmap[w.user_id]).filter(Boolean);
  const memberList = (members ?? []).map((m: any) => ({ email: m.profiles?.email, full_name: m.profiles?.full_name })).filter((m: any) => m.email);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Realtime channel={`task:${t.id}`} subs={[
        { table: 'comments', filter: `task_id=eq.${t.id}` },
        { table: 'tasks', filter: `id=eq.${t.id}` }
      ]} />
      <Link href={`/teams/${team?.team_key}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> {team?.name}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <TeamKeyBadge k={t.tag} />
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              {t.labels?.map((l) => <span key={l} className="chip">{l}</span>)}
            </div>
            <h1 className="mt-3 text-xl font-bold">{t.title}</h1>
            <div className="mt-1 text-xs text-fg-muted">
              Opened by {creator?.full_name || creator?.email || 'someone'} · {timeAgo(t.created_at)}
            </div>
            <div className="mt-4 border-t border-border pt-4">
              {t.description ? <Markdown>{t.description}</Markdown> : <p className="text-sm text-fg-muted">No description provided.</p>}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Activity & comments</h2>
            <div className="space-y-3">
              {(comments ?? []).length === 0 && <p className="text-sm text-fg-muted">No comments yet. Start the conversation below.</p>}
              {(comments ?? []).map((c: any) => {
                const a = pmap[c.author_id];
                return (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={a?.full_name} email={a?.email} src={a?.avatar_url} size={32} />
                    <div className="card flex-1 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{a?.full_name || a?.email || 'Unknown'}</span>
                        <span className="text-fg-muted">{timeAgo(c.created_at)}</span>
                      </div>
                      <div className="mt-1"><Markdown>{c.body}</Markdown></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {caps.includes('COMMENT') && <AddComment taskId={t.id} canEmail={caps.includes('SEND_EMAIL')} />}
          </div>
        </div>

        <TaskSidebar task={t} caps={caps} members={memberList} watchers={watchers} assignee={assignee} currentUserId={user.id} />
      </div>
    </div>
  );
}
