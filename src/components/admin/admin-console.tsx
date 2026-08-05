'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShieldCheck, ShieldOff, UserCog, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { TeamKeyBadge } from '@/components/ui/badges';
import { useToast } from '@/components/ui/toast';
import { createTeam, assignManager, setTeamStatus } from '@/lib/actions/teams';
import { setGlobalRole, setUserStatus } from '@/lib/actions/admin';

interface TeamRow { id: string; team_key: string; name: string; description: string | null; status: string; members: number; manager: string | null; }
interface UserRow { id: string; email: string; full_name: string | null; avatar_url: string | null; global_role: string; status: string; }

export function AdminConsole({ teams, users, currentUserId }: { teams: TeamRow[]; users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<'teams' | 'users'>('teams');

  const [createOpen, setCreateOpen] = useState(false);
  const [key, setKey] = useState(''); const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [mgr, setMgr] = useState('');
  const [assignFor, setAssignFor] = useState<TeamRow | null>(null); const [assignEmail, setAssignEmail] = useState('');

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: any }>, msg: string, after?: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { toast((r as any).data?.warning || msg, 'success'); after?.(); router.refresh(); } else toast(r.error || 'Error', 'error'); });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('teams')} className={`chip ${tab === 'teams' ? '!bg-primary/15 !text-primary' : ''}`}>Teams ({teams.length})</button>
        <button onClick={() => setTab('users')} className={`chip ${tab === 'users' ? '!bg-primary/15 !text-primary' : ''}`}>Users ({users.length})</button>
      </div>

      {tab === 'teams' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create team</Button>
          </div>
          <div className="grid gap-2">
            {teams.map((t) => (
              <div key={t.id} className="card flex items-center gap-3 p-3">
                <TeamKeyBadge k={t.team_key} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name} {t.status === 'archived' && <span className="chip ml-1">archived</span>}</div>
                  <div className="truncate text-xs text-fg-muted">{t.members} members · Manager: {t.manager || '—'}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setAssignFor(t); setAssignEmail(''); }}><UserCog className="h-4 w-4" /> Manager</Button>
                {t.status !== 'archived'
                  ? <button className="text-fg-muted hover:text-danger" title="Archive team"
                      onClick={() => { if (window.confirm(`Archive "${t.name}"? Existing members keep access, but it disappears from the join list until you unarchive it.`)) run(() => setTeamStatus(t.id, 'archived'), 'Team archived'); }}>
                      <Archive className="h-4 w-4" /></button>
                  : <Button size="sm" variant="outline" onClick={() => run(() => setTeamStatus(t.id, 'active'), 'Team restored')}><ArchiveRestore className="h-4 w-4" /> Unarchive</Button>}
              </div>
            ))}
            {teams.length === 0 && <div className="card p-8 text-center text-sm text-fg-muted">No teams yet — create the first one.</div>}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="grid gap-2">
          {users.map((u) => (
            <div key={u.id} className="card flex items-center gap-3 p-3">
              <Avatar name={u.full_name} email={u.email} src={u.avatar_url} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{u.full_name || u.email}</div>
                <div className="truncate text-xs text-fg-muted">{u.email}</div>
              </div>
              {u.global_role === 'super_admin' && <span className="chip" style={{ background: 'hsl(var(--primary)/0.12)', color: 'hsl(var(--primary))' }}>Admin</span>}
              {u.status === 'suspended' && <span className="chip" style={{ background: 'hsl(var(--danger)/0.12)', color: 'hsl(var(--danger))' }}>Suspended</span>}
              {u.id !== currentUserId && (
                <>
                  {u.global_role === 'super_admin'
                    ? <Button size="sm" variant="outline" onClick={() => run(() => setGlobalRole(u.id, 'user'), 'Role updated')}><ShieldOff className="h-4 w-4" /> Revoke admin</Button>
                    : <Button size="sm" variant="outline" onClick={() => run(() => setGlobalRole(u.id, 'super_admin'), 'Role updated')}><ShieldCheck className="h-4 w-4" /> Make admin</Button>}
                  {u.status === 'suspended'
                    ? <Button size="sm" variant="ghost" onClick={() => run(() => setUserStatus(u.id, 'active'), 'Reactivated')}>Reactivate</Button>
                    : <Button size="sm" variant="ghost" onClick={() => run(() => setUserStatus(u.id, 'suspended'), 'Suspended')}>Suspend</Button>}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create team">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Key</label><input className="input font-mono uppercase" maxLength={8} value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="ENG" /></div>
            <div className="col-span-2"><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" /></div>
          </div>
          <div><label className="label">Description</label><textarea className="input min-h-20" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><label className="label">Manager email (optional)</label><input className="input" value={mgr} onChange={(e) => setMgr(e.target.value)} placeholder="lead@nxtwave.co.in" /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={() => run(() => createTeam({ team_key: key, name, description: desc, manager_email: mgr }), 'Team created', () => { setCreateOpen(false); setKey(''); setName(''); setDesc(''); setMgr(''); })}>Create</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!assignFor} onClose={() => setAssignFor(null)} title={`Set manager for ${assignFor?.name}`}>
        <label className="label">Manager email (must have signed in once)</label>
        <input className="input" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="manager@nxtwave.co.in" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAssignFor(null)}>Cancel</Button>
          <Button loading={pending} onClick={() => assignFor && run(() => assignManager(assignFor.id, assignEmail), 'Manager assigned', () => setAssignFor(null))}>Assign</Button>
        </div>
      </Dialog>
    </div>
  );
}
