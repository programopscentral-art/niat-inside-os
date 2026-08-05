import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { TeamKeyBadge } from '@/components/ui/badges';
import { JoinButton } from '@/components/team/join-button';

export default async function TeamsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServer();

  const [{ data: teams }, { data: myMemberships }, { data: myRequests }, { data: managers }] = await Promise.all([
    supabase.from('teams').select('*').eq('status', 'active').order('name'),
    supabase.from('team_members').select('team_id').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('join_requests').select('team_id, status').eq('user_id', user.id).eq('status', 'pending'),
    supabase.from('team_members').select('team_id, profiles(full_name, email)').eq('team_role', 'manager').eq('status', 'active')
  ]);

  const memberOf = new Set((myMemberships ?? []).map((m: any) => m.team_id));
  const requested = new Set((myRequests ?? []).map((r: any) => r.team_id));
  const managerOf = new Map<string, string>();
  for (const m of managers ?? []) {
    const p: any = (m as any).profiles;
    if (p) managerOf.set((m as any).team_id, p.full_name || p.email);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teams</h1>
        <p className="mt-1 text-fg-muted">Browse teams and request to join. You’ll only see a team’s work once you’re a member.</p>
      </div>

      {(!teams || teams.length === 0) && (
        <div className="card grid place-items-center p-10 text-sm text-fg-muted">No teams have been created yet.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(teams ?? []).map((t: any) => {
          const isMember = memberOf.has(t.id);
          const isRequested = requested.has(t.id);
          return (
            <div key={t.id} className="card flex flex-col p-5 transition-all hover:shadow-soft">
              <div className="flex items-center gap-2">
                <TeamKeyBadge k={t.team_key} />
                <h3 className="font-semibold">{t.name}</h3>
              </div>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm text-fg-muted">{t.description || 'No description.'}</p>
              <div className="mt-3 text-xs text-fg-muted">Manager: {managerOf.get(t.id) || '—'}</div>
              <div className="mt-4 pt-3 border-t border-border">
                {isMember ? (
                  <Link href={`/teams/${t.team_key}`} className="btn btn-primary btn-md w-full">Open board <ArrowRight className="h-4 w-4" /></Link>
                ) : isRequested ? (
                  <span className="chip w-full justify-center py-2" style={{ background: 'hsl(var(--warning)/0.12)', color: 'hsl(var(--warning))' }}>
                    <Clock className="h-4 w-4" /> Request pending
                  </span>
                ) : (
                  <JoinButton teamId={t.id} teamName={t.name} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
