import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { effectiveCaps, CAPS, type TeamRole } from '@/lib/capabilities';
import { TeamKeyBadge } from '@/components/ui/badges';
import { ManagePanel } from '@/components/team/manage-panel';

export default async function ManageTeamPage({ params }: { params: { key: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const admin = isAdmin(user);

  const { data: team } = await supabase.from('teams').select('*').eq('team_key', params.key.toUpperCase()).maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from('team_members').select('*').eq('team_id', team.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();

  const caps = admin ? [...CAPS] : (membership ? [...effectiveCaps(membership.team_role as TeamRole, membership.permissions ?? [])] : []);
  const canManageMembers = caps.includes('MANAGE_MEMBERS');
  const canApprove = caps.includes('APPROVE_JOIN');
  if (!canManageMembers && !canApprove) redirect(`/teams/${team.team_key}`);

  const [{ data: members }, { data: requests }] = await Promise.all([
    supabase.from('team_members').select('id, user_id, team_role, permissions, profiles(email, full_name, avatar_url)').eq('team_id', team.id).eq('status', 'active').order('team_role'),
    supabase.from('join_requests').select('id, message, created_at, profiles(email, full_name)').eq('team_id', team.id).eq('status', 'pending').order('created_at')
  ]);

  const memberData = (members ?? []).map((m: any) => ({ id: m.id, user_id: m.user_id, team_role: m.team_role, permissions: m.permissions ?? [], profile: m.profiles }));
  const reqData = (requests ?? []).map((r: any) => ({ id: r.id, message: r.message, created_at: r.created_at, profile: r.profiles }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/teams/${team.team_key}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back to board</Link>
      <div className="flex items-center gap-2">
        <TeamKeyBadge k={team.team_key} />
        <h1 className="text-2xl font-bold">Manage {team.name}</h1>
      </div>
      <ManagePanel teamId={team.id} teamKey={team.team_key} members={memberData} requests={reqData} canManageMembers={canManageMembers} canApprove={canApprove} />
    </div>
  );
}
