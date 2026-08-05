import { requireUser, getMyTeams, isAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const teams = await getMyTeams();

  const supabase = createSupabaseServer();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  return (
    <AppShell
      user={{
        name: user.profile.full_name || user.email,
        email: user.email,
        avatar: user.profile.avatar_url,
        isAdmin: isAdmin(user)
      }}
      teams={teams.map((t) => ({ team_key: t.team_key, name: t.name })).sort((a, b) => a.name.localeCompare(b.name))}
      unread={count ?? 0}
    >
      {children}
    </AppShell>
  );
}
