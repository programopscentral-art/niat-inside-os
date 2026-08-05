import { redirect } from 'next/navigation';
import { requireUser, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { AdminConsole } from '@/components/admin/admin-console';
import { STATUS_META, type TaskStatus } from '@/lib/types';

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect('/dashboard');
  const supabase = createSupabaseServer();

  const [{ data: teams }, { data: memberships }, { data: users }, { data: stats }] = await Promise.all([
    supabase.from('teams').select('*').order('created_at', { ascending: false }),
    supabase.from('team_members').select('team_id, team_role, profiles(email, full_name)').eq('status', 'active'),
    supabase.from('profiles').select('id, email, full_name, avatar_url, global_role, status').order('created_at', { ascending: false }),
    supabase.rpc('admin_task_stats')
  ]);

  const counts = new Map<string, number>();
  const managers = new Map<string, string>();
  for (const m of memberships ?? []) {
    counts.set((m as any).team_id, (counts.get((m as any).team_id) ?? 0) + 1);
    if ((m as any).team_role === 'manager') {
      const p: any = (m as any).profiles;
      if (p) managers.set((m as any).team_id, p.full_name || p.email);
    }
  }

  const teamRows = (teams ?? []).map((t: any) => ({
    id: t.id, team_key: t.team_key, name: t.name, description: t.description, status: t.status,
    members: counts.get(t.id) ?? 0, manager: managers.get(t.id) ?? null
  }));

  const statMap = new Map<string, number>();
  for (const s of (stats as any[]) ?? []) statMap.set(s.status, Number(s.count));
  const totalTasks = [...statMap.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin console</h1>
        <p className="mt-1 text-fg-muted">Create teams, appoint managers, and manage users across the organization.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card p-4"><div className="text-2xl font-extrabold">{teamRows.length}</div><div className="text-xs text-fg-muted">Teams</div></div>
        <div className="card p-4"><div className="text-2xl font-extrabold">{users?.length ?? 0}</div><div className="text-xs text-fg-muted">Users</div></div>
        {(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as TaskStatus[]).map((s) => (
          <div key={s} className="card p-4">
            <div className="text-2xl font-extrabold" style={{ color: STATUS_META[s].color }}>{statMap.get(s) ?? 0}</div>
            <div className="text-xs text-fg-muted">{STATUS_META[s].label}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-fg-muted">{totalTasks} tasks across all teams.</div>

      <AdminConsole teams={teamRows} users={(users ?? []) as any} currentUserId={user.id} />
    </div>
  );
}
