import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { effectiveCaps, CAPS, type TeamRole } from '@/lib/capabilities';
import { TeamKeyBadge } from '@/components/ui/badges';
import { CollegesPanel } from '@/components/college/colleges-panel';
import { Realtime } from '@/components/realtime';
import type { College } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CollegesPage({ params }: { params: { key: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const admin = isAdmin(user);

  const { data: team } = await supabase.from('teams').select('*').eq('team_key', params.key.toUpperCase()).maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from('team_members').select('*').eq('team_id', team.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (!membership && !admin) redirect(`/teams/${team.team_key}`);

  const caps = admin ? [...CAPS] : (membership ? [...effectiveCaps(membership.team_role as TeamRole, membership.permissions ?? [])] : []);
  const canManage = admin || caps.includes('MANAGE_COLLEGES');
  const canCreateTask = admin || caps.includes('CREATE_TASK');
  const canAssign = admin || caps.includes('ASSIGN_TASK');

  const [{ data: colleges }, { data: members }] = await Promise.all([
    supabase.from('colleges').select('*').eq('team_id', team.id).order('name'),
    supabase.from('team_members').select('profiles(email, full_name)').eq('team_id', team.id).eq('status', 'active')
  ]);

  const memberList = (members ?? []).map((m: any) => ({ email: m.profiles?.email, full_name: m.profiles?.full_name })).filter((m: any) => m.email);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Realtime channel={`colleges:${team.id}`} subs={[{ table: 'colleges', filter: `team_id=eq.${team.id}` }]} />
      <Link href={`/teams/${team.team_key}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back to board</Link>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TeamKeyBadge k={team.team_key} />
          <h1 className="text-2xl font-bold">Colleges & assignments</h1>
        </div>
      </div>
      <p className="-mt-2 text-sm text-fg-muted">
        Who takes care of which university. {canManage ? 'Add or edit below.' : 'Read-only — ask a manager to make changes.'}
      </p>

      <CollegesPanel teamId={team.id} colleges={(colleges ?? []) as College[]} canManage={canManage}
        canCreateTask={canCreateTask} canAssign={canAssign} members={memberList} />
    </div>
  );
}
