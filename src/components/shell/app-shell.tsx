'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users2, Bell, Shield, Search, Moon, Sun, LogOut, Menu, X, Hash
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { TeamKeyBadge } from '@/components/ui/badges';
import { Realtime } from '@/components/realtime';
import { cn } from '@/lib/utils';

interface TeamLink { team_key: string; name: string; }
interface Props {
  userId: string;
  user: { name: string; email: string; avatar: string | null; isAdmin: boolean };
  teams: TeamLink[];
  unread: number;
  children: React.ReactNode;
}

export function AppShell({ userId, user, teams, unread, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleTheme() {
    const el = document.documentElement;
    const next = !el.classList.contains('dark');
    el.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const tag = q.trim().toUpperCase();
    if (tag) router.push(`/tasks/${encodeURIComponent(tag)}`);
  }

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/teams', label: 'Teams', icon: Users2 },
    { href: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
    ...(user.isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : [])
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Live: my notifications + my team memberships (join approvals, removals) */}
      <Realtime channel={`me:${userId}`} subs={[
        { table: 'notifications', filter: `recipient_id=eq.${userId}` },
        { table: 'team_members', filter: `user_id=eq.${userId}` }
      ]} />
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-[260px] glass border-r border-border p-4 flex flex-col transition-transform lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-extrabold gradient-text">NIAT Inside OS</Link>
          <button className="lg:hidden text-fg-muted" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="mt-6 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/');
            return (
              <Link key={n.href} href={n.href}
                className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-muted hover:text-fg')}>
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label}</span>
                {'badge' in n && n.badge ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{n.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-fg-muted px-3">My teams</div>
        <div className="mt-2 space-y-0.5 overflow-y-auto flex-1">
          {teams.length === 0 && <p className="px-3 text-xs text-fg-muted">No teams yet. <Link href="/teams" className="text-primary">Join one →</Link></p>}
          {teams.map((t) => {
            const active = pathname.startsWith(`/teams/${t.team_key}`);
            return (
              <Link key={t.team_key} href={`/teams/${t.team_key}`}
                className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-muted text-fg' : 'text-fg-muted hover:bg-muted hover:text-fg')}>
                <TeamKeyBadge k={t.team_key} />
                <span className="truncate">{t.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 border-t border-border pt-3 flex items-center gap-3">
          <Avatar name={user.name} email={user.email} src={user.avatar} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-fg-muted">{user.email}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="text-fg-muted hover:text-danger" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex min-h-screen flex-col">
        <header className="glass sticky top-0 z-20 flex items-center gap-3 border-b border-border px-4 py-3">
          <button className="lg:hidden text-fg-muted" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <form onSubmit={onSearch} className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to ticket (e.g. ENG-1042)…"
              className="input pl-9" />
          </form>
          <Link href="/notifications" className="relative rounded-md p-2 text-fg-muted hover:bg-muted hover:text-fg">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />}
          </Link>
          <button onClick={toggleTheme} className="rounded-md p-2 text-fg-muted hover:bg-muted hover:text-fg" title="Toggle theme">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
