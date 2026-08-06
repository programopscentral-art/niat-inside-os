import { requireUser, getMyTeams, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { effectiveCaps, type TeamRole } from '@/lib/capabilities';
import { TicketsView } from '@/components/task/tickets-view';
import { Realtime } from '@/components/realtime';
import type { Task } from '@/lib/types';
import type { RaiseTeam } from '@/components/task/raise-ticket-dialog';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const supabase = createSupabaseServer();
  const myTeams = await getMyTeams();

  // Teams the user can raise a ticket in.
  const raise: RaiseTeam[] = [];
  const seen = new Set<string>();
  for (const t of myTeams) {
    const caps = admin ? null : effectiveCaps(t.membership.team_role as TeamRole, t.membership.permissions ?? []);
    const canCreate = admin || caps!.has('CREATE_TASK');
    if (!canCreate) continue;
    seen.add(t.id);
    raise.push({ id: t.id, team_key: t.team_key, name: t.name, canAssign: admin || caps!.has('ASSIGN_TASK'), canEmail: admin || caps!.has('SEND_EMAIL') });
  }
  if (admin) {
    const { data: allTeams } = await supabase.from('teams').select('id, team_key, name').eq('status', 'active');
    for (const t of allTeams ?? []) {
      if (seen.has(t.id)) continue;
      raise.push({ id: t.id, team_key: t.team_key, name: t.name, canAssign: true, canEmail: true });
    }
  }
  raise.sort((a, b) => a.team_key.localeCompare(b.team_key));

  // All tickets the user can see (RLS-scoped: their teams + watched + admin=all).
  const { data: rows } = await supabase
    .from('tasks').select('*, teams(team_key, name)')
    .order('updated_at', { ascending: false }).limit(200);

  const tickets = (rows ?? []).map((r: any) => ({ ...r, team_key: r.teams?.team_key })) as (Task & { team_key?: string })[];

  const ids = [...new Set(tickets.map((t) => t.assignee_id).filter(Boolean))] as string[];
  const assignees: Record<string, any> = {};
  if (ids.length) {
    const { data: people } = await supabase.from('profiles').select('id, email, full_name, avatar_url').in('id', ids);
    (people ?? []).forEach((p: any) => (assignees[p.id] = p));
  }

  return (
    <>
      <Realtime channel="my-tickets" subs={[{ table: 'tasks' }]} />
      <TicketsView tickets={tickets} assignees={assignees} teams={raise} currentUserId={user.id} />
    </>
  );
}
