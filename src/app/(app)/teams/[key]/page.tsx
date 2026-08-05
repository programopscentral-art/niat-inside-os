import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Settings2, Lock, BarChart3 } from 'lucide-react';
import { requireUser, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { effectiveCaps, ROLE_LABELS, CAPS, type TeamRole } from '@/lib/capabilities';
import { TeamKeyBadge } from '@/components/ui/badges';
import { Board } from '@/components/board/board';
import { CreateTaskDialog } from '@/components/task/create-task-dialog';
import { JoinButton } from '@/components/team/join-button';
import type { Task } from '@/lib/types';

export default async function TeamBoardPage({ params }: { params: { key: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const admin = isAdmin(user);

  const { data: team } = await supabase.from('teams').select('*').eq('team_key', params.key.toUpperCase()).maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from('team_members').select('*').eq('team_id', team.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();

  // Not a member and not admin → show a locked panel with a join CTA.
  if (!membership && !admin) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted"><Lock className="h-6 w-6 text-fg-muted" /></div>
          <h1 className="mt-4 text-lg font-bold">{team.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">You’re not a member of this team, so its work is hidden. Request access to view the board.</p>
          <div className="mt-5 flex justify-center"><JoinButton teamId={team.id} teamName={team.name} /></div>
        </div>
      </div>
    );
  }

  const role: TeamRole = (membership?.team_role as TeamRole) || 'manager';
  const caps = admin ? [...CAPS] : [...effectiveCaps(role, membership?.permissions ?? [])];

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from('tasks').select('*').eq('team_id', team.id).order('created_at', { ascending: false }),
    supabase.from('team_members').select('user_id, team_role, profiles(email, full_name, avatar_url)').eq('team_id', team.id).eq('status', 'active')
  ]);

  const assignees: Record<string, any> = {};
  for (const m of members ?? []) {
    const p: any = (m as any).profiles;
    if (p) assignees[(m as any).user_id] = p;
  }
  // Include any assignees who aren't current members (edge case).
  const missing = (tasks ?? []).map((t: any) => t.assignee_id).filter((id: string) => id && !assignees[id]);
  if (missing.length) {
    const { data: extra } = await supabase.from('profiles').select('id, email, full_name, avatar_url').in('id', missing);
    for (const p of extra ?? []) assignees[p.id] = p;
  }

  const memberList = (members ?? []).map((m: any) => ({ email: m.profiles?.email, full_name: m.profiles?.full_name })).filter((m: any) => m.email);
  const canManage = admin || caps.includes('MANAGE_MEMBERS') || caps.includes('APPROVE_JOIN');

  const open = (tasks ?? []).filter((t: any) => !['DONE', 'CANCELLED'].includes(t.status)).length;
  const overdue = (tasks ?? []).filter((t: any) => t.due_date && !['DONE', 'CANCELLED'].includes(t.status) && new Date(t.due_date) < new Date(new Date().toDateString())).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TeamKeyBadge k={team.team_key} />
            <h1 className="text-2xl font-bold">{team.name}</h1>
          </div>
          {team.description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{team.description}</p>}
          <div className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
            <span>{members?.length ?? 0} members</span>·<span>{open} open</span>
            {overdue > 0 && <><span>·</span><span className="text-danger font-medium">{overdue} overdue</span></>}
            <span>·</span><span>Your role: <b>{admin ? 'Admin' : ROLE_LABELS[role]}</b></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/teams/${team.team_key}/analytics`} className="btn btn-outline btn-md"><BarChart3 className="h-4 w-4" /> Insights</Link>
          {canManage && (
            <Link href={`/teams/${team.team_key}/manage`} className="btn btn-outline btn-md"><Settings2 className="h-4 w-4" /> Manage</Link>
          )}
          {caps.includes('CREATE_TASK') && (
            <CreateTaskDialog teamId={team.id} members={memberList} canAssign={caps.includes('ASSIGN_TASK')} canEmail={caps.includes('SEND_EMAIL')} />
          )}
        </div>
      </div>

      <Board tasks={(tasks ?? []) as Task[]} assignees={assignees} caps={caps} currentUserId={user.id} teamId={team.id} />
    </div>
  );
}
