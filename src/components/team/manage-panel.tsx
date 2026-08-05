'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, Check, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { RoleBadge } from '@/components/ui/badges';
import { useToast } from '@/components/ui/toast';
import { CAPS, CAP_LABELS, ROLE_CAPS, ROLE_LABELS, type Cap, type TeamRole } from '@/lib/capabilities';
import { addMember, updateMember, removeMember } from '@/lib/actions/members';
import { decideJoinRequest } from '@/lib/actions/join';
import { timeAgo } from '@/lib/utils';

interface Member { id: string; user_id: string; team_role: TeamRole; permissions: string[]; profile: { email: string; full_name: string | null; avatar_url: string | null } | null; }
interface Req { id: string; message: string | null; created_at: string; profile: { email: string; full_name: string | null } | null; }

const ROLES: TeamRole[] = ['manager', 'lead', 'member', 'viewer'];

function PermissionMatrix({ role, extra, onToggle }: { role: TeamRole; extra: Set<Cap>; onToggle: (c: Cap) => void }) {
  const defaults = new Set(ROLE_CAPS[role]);
  return (
    <div className="grid grid-cols-2 gap-2">
      {CAPS.map((c) => {
        const isDefault = defaults.has(c);
        const checked = isDefault || extra.has(c);
        return (
          <label key={c} className={`flex items-center gap-2 rounded-md border border-border p-2 text-xs ${isDefault ? 'opacity-70' : 'cursor-pointer hover:bg-muted'}`}>
            <input type="checkbox" checked={checked} disabled={isDefault} onChange={() => onToggle(c)} />
            <span>{CAP_LABELS[c]}</span>
          </label>
        );
      })}
    </div>
  );
}

export function ManagePanel({ teamId, teamKey, members, requests, canManageMembers, canApprove }:
  { teamId: string; teamKey: string; members: Member[]; requests: Req[]; canManageMembers: boolean; canApprove: boolean }) {
  const [tab, setTab] = useState<'members' | 'requests'>(requests.length ? 'requests' : 'members');
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [extra, setExtra] = useState<Set<Cap>>(new Set());

  // Edit member dialog
  const [editing, setEditing] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>('member');
  const [editExtra, setEditExtra] = useState<Set<Cap>>(new Set());

  // Approve dialog
  const [approving, setApproving] = useState<Req | null>(null);
  const [apprRole, setApprRole] = useState<TeamRole>('member');
  const [apprExtra, setApprExtra] = useState<Set<Cap>>(new Set());
  const [apprEmail, setApprEmail] = useState(false);

  const toggle = (set: Set<Cap>, setter: (s: Set<Cap>) => void) => (c: Cap) => {
    const n = new Set(set); n.has(c) ? n.delete(c) : n.add(c); setter(n);
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { toast(msg, 'success'); after?.(); router.refresh(); } else toast(r.error || 'Error', 'error'); });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('members')} className={`chip ${tab === 'members' ? '!bg-primary/15 !text-primary' : ''}`}>Members ({members.length})</button>
        <button onClick={() => setTab('requests')} className={`chip ${tab === 'requests' ? '!bg-primary/15 !text-primary' : ''}`}>Requests ({requests.length})</button>
      </div>

      {tab === 'members' && (
        <div className="space-y-3">
          {canManageMembers && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setAddOpen(true); setExtra(new Set()); }}><UserPlus className="h-4 w-4" /> Add member</Button>
            </div>
          )}
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <Avatar name={m.profile?.full_name} email={m.profile?.email} src={m.profile?.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.profile?.full_name || m.profile?.email}</div>
                  <div className="truncate text-xs text-fg-muted">{m.profile?.email}</div>
                </div>
                <RoleBadge role={m.team_role} />
                {m.permissions.length > 0 && <span className="chip"><Shield className="h-3 w-3" /> +{m.permissions.length}</span>}
                {canManageMembers && m.team_role !== 'manager' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(m); setEditRole(m.team_role); setEditExtra(new Set(m.permissions as Cap[])); }}>Edit</Button>
                    <button className="text-fg-muted hover:text-danger" onClick={() => run(() => removeMember(m.id), 'Member removed')}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 && <div className="card p-8 text-center text-sm text-fg-muted">No pending requests.</div>}
          {requests.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 p-3">
              <Avatar name={r.profile?.full_name} email={r.profile?.email} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.profile?.full_name || r.profile?.email}</div>
                <div className="truncate text-xs text-fg-muted">{r.message || 'No message'} · {timeAgo(r.created_at)}</div>
              </div>
              {canApprove && (
                <>
                  <Button size="sm" onClick={() => { setApproving(r); setApprRole('member'); setApprExtra(new Set()); setApprEmail(false); }}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => run(() => decideJoinRequest({ requestId: r.id, approve: false, role: 'member', extraCaps: [], email: false }), 'Request rejected')}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add member */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add member">
        <div className="space-y-3">
          <div><label className="label">Email (@nxtwave.co.in)</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@nxtwave.co.in" /></div>
          <div><label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          </div>
          <div><label className="label">Extra permissions (beyond role defaults)</label><PermissionMatrix role={role} extra={extra} onToggle={toggle(extra, setExtra)} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={() => run(() => addMember(teamId, email, role, [...extra]), 'Member added', () => { setAddOpen(false); setEmail(''); })}>Add</Button>
          </div>
        </div>
      </Dialog>

      {/* Edit member */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.profile?.full_name || editing?.profile?.email || 'member'}`}>
        <div className="space-y-3">
          <div><label className="label">Role</label>
            <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value as TeamRole)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          </div>
          <div><label className="label">Extra permissions</label><PermissionMatrix role={editRole} extra={editExtra} onToggle={toggle(editExtra, setEditExtra)} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={pending} onClick={() => editing && run(() => updateMember(editing.id, editRole, [...editExtra]), 'Member updated', () => setEditing(null))}>Save</Button>
          </div>
        </div>
      </Dialog>

      {/* Approve request */}
      <Dialog open={!!approving} onClose={() => setApproving(null)} title="Approve join request">
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">Grant <b>{approving?.profile?.full_name || approving?.profile?.email}</b> access with:</p>
          <div><label className="label">Role</label>
            <select className="input" value={apprRole} onChange={(e) => setApprRole(e.target.value as TeamRole)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          </div>
          <div><label className="label">Extra permissions</label><PermissionMatrix role={apprRole} extra={apprExtra} onToggle={toggle(apprExtra, setApprExtra)} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={apprEmail} onChange={(e) => setApprEmail(e.target.checked)} /> Email them the decision</label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setApproving(null)}>Cancel</Button>
            <Button loading={pending} onClick={() => approving && run(() => decideJoinRequest({ requestId: approving.id, approve: true, role: apprRole, extraCaps: [...apprExtra], email: apprEmail }), 'Approved', () => setApproving(null))}>Approve & add</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
