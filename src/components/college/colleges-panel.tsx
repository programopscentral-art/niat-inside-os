'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail, IdCard, MapPin, User, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PersonPicker } from '@/components/ui/person-picker';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { createCollege, updateCollege, deleteCollege } from '@/lib/actions/colleges';
import { createTask } from '@/lib/actions/tasks';
import { COLLEGE_STATUS_META, type College, type TaskPriority } from '@/lib/types';

interface Member { email: string; full_name: string | null; }
interface Form {
  name: string; city: string; caretaker_name: string; caretaker_email: string;
  caretaker_phone: string; designation: string; employee_id: string;
  status: College['status']; notes: string;
}

const EMPTY: Form = {
  name: '', city: '', caretaker_name: '', caretaker_email: '', caretaker_phone: '',
  designation: '', employee_id: '', status: 'active', notes: ''
};

export function CollegesPanel({ teamId, colleges, canManage, canCreateTask, canAssign, members }:
  { teamId: string; colleges: College[]; canManage: boolean; canCreateTask?: boolean; canAssign?: boolean; members: Member[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  // Raise-ticket dialog state
  const [ticketFor, setTicketFor] = useState<College | null>(null);
  const [tk, setTk] = useState({ title: '', description: '', priority: 'MEDIUM' as TaskPriority, due: '', assignee: '', notify: false });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return colleges.filter((c) =>
      `${c.name} ${c.city ?? ''} ${c.caretaker_name ?? ''} ${c.caretaker_email ?? ''} ${c.employee_id ?? ''}`.toLowerCase().includes(ql));
  }, [colleges, q]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() { setEditId(null); setForm(EMPTY); setOpen(true); }
  function openEdit(c: College) {
    setEditId(c.id);
    setForm({
      name: c.name, city: c.city ?? '', caretaker_name: c.caretaker_name ?? '', caretaker_email: c.caretaker_email ?? '',
      caretaker_phone: c.caretaker_phone ?? '', designation: c.designation ?? '', employee_id: c.employee_id ?? '',
      status: c.status, notes: c.notes ?? ''
    });
    setOpen(true);
  }

  function save() {
    start(async () => {
      const r = editId ? await updateCollege(editId, form) : await createCollege(teamId, form);
      if (r.ok) { toast(editId ? 'College updated' : 'College added', 'success'); setOpen(false); router.refresh(); }
      else toast(r.error, 'error');
    });
  }
  function remove(c: College) {
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    start(async () => { const r = await deleteCollege(c.id); if (r.ok) { toast('Deleted', 'success'); router.refresh(); } else toast(r.error, 'error'); });
  }

  function openTicket(c: College) {
    const caretakerIsMember = !!c.caretaker_email && members.some((m) => m.email === c.caretaker_email);
    const where = c.city ? `${c.name} (${c.city})` : c.name;
    setTicketFor(c);
    setTk({
      title: `${c.name}: `,
      description: `**College:** ${where}\n**Caretaker:** ${c.caretaker_name || '—'}${c.caretaker_email ? ` (${c.caretaker_email})` : ''}\n\n`,
      priority: 'MEDIUM',
      due: '',
      assignee: canAssign && caretakerIsMember ? c.caretaker_email! : '',
      notify: false
    });
  }

  function submitTicket() {
    if (!ticketFor) return;
    start(async () => {
      const r = await createTask({
        teamId, title: tk.title.trim(), description: tk.description, priority: tk.priority,
        assigneeEmail: tk.assignee, dueDate: tk.due, labels: [ticketFor.name], notifyEmail: tk.notify
      });
      if (r.ok) { toast(`Created ${r.data?.tag}`, 'success'); setTicketFor(null); router.push(`/tasks/${r.data?.tag}`); }
      else toast(r.error, 'error');
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input className="input pl-9" placeholder="Search college, caretaker, city, emp ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="chip">{filtered.length} college{filtered.length === 1 ? '' : 's'}</span>
        <div className="flex-1" />
        {canManage && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add college</Button>}
      </div>

      {filtered.length === 0 && (
        <div className="card grid place-items-center gap-2 p-10 text-center text-sm text-fg-muted">
          <Building2 className="h-8 w-8" />
          {colleges.length === 0 ? 'No colleges yet.' : 'No matches.'}
          {canManage && colleges.length === 0 && <Button size="sm" variant="outline" onClick={openCreate}>Add the first one</Button>}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((c) => {
          const sm = COLLEGE_STATUS_META[c.status];
          return (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'hsl(var(--primary)/0.12)' }}>
                    <Building2 className="h-5 w-5 text-primary" />
                  </span>
                  <div>
                    <div className="font-semibold leading-tight">{c.name}</div>
                    {c.city && <div className="text-xs text-fg-muted inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</div>}
                  </div>
                </div>
                <span className="chip" style={{ background: `${sm.color}1a`, color: sm.color }}>{sm.label}</span>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  {c.caretaker_email
                    ? <Avatar name={c.caretaker_name} email={c.caretaker_email} size={22} />
                    : <User className="h-4 w-4 text-fg-muted" />}
                  <span className="font-medium">{c.caretaker_name || c.caretaker_email || 'Unassigned'}</span>
                  {c.designation && <span className="chip">{c.designation}</span>}
                </div>
                {c.caretaker_email && <div className="flex items-center gap-2 text-xs text-fg-muted"><Mail className="h-3 w-3" />{c.caretaker_email}</div>}
                {c.caretaker_phone && <div className="flex items-center gap-2 text-xs text-fg-muted"><Phone className="h-3 w-3" />{c.caretaker_phone}</div>}
                {c.employee_id && <div className="flex items-center gap-2 text-xs text-fg-muted"><IdCard className="h-3 w-3" />{c.employee_id}</div>}
                {c.notes && <p className="mt-1 rounded-md bg-muted p-2 text-xs">{c.notes}</p>}
              </div>

              {(canManage || canCreateTask) && (
                <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
                  {canCreateTask && <Button size="sm" variant="outline" onClick={() => openTicket(c)}><Ticket className="h-3.5 w-3.5" /> Raise ticket</Button>}
                  <div className="flex-1" />
                  {canManage && <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                  {canManage && <button className="rounded-md px-2 text-fg-muted hover:text-danger" onClick={() => remove(c)} title="Delete"><Trash2 className="h-4 w-4" /></button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={editId ? 'Edit college' : 'Add college'} className="max-w-xl">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">College / University *</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. CDU" /></div>
            <div><label className="label">City / location</label><input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Hyderabad" /></div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Caretaker</div>
            {members.length > 0 && (
              <div>
                <label className="label">Pick a team member (autofills)</label>
                <PersonPicker people={members} value={form.caretaker_email || undefined}
                  onSelect={(email) => {
                    const m = members.find((x) => x.email === email);
                    setForm((f) => ({ ...f, caretaker_email: email, caretaker_name: m?.full_name || f.caretaker_name }));
                  }} placeholder="Search team members…" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name</label><input className="input" value={form.caretaker_name ?? ''} onChange={(e) => set('caretaker_name', e.target.value)} /></div>
              <div><label className="label">Office email</label><input className="input" value={form.caretaker_email ?? ''} onChange={(e) => set('caretaker_email', e.target.value)} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.caretaker_phone ?? ''} onChange={(e) => set('caretaker_phone', e.target.value)} /></div>
              <div><label className="label">Designation</label><input className="input" value={form.designation ?? ''} onChange={(e) => set('designation', e.target.value)} placeholder="BOA-1, PM…" /></div>
              <div><label className="label">Employee ID</label><input className="input" value={form.employee_id ?? ''} onChange={(e) => set('employee_id', e.target.value)} placeholder="NW00…" /></div>
              <div><label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="active">Active</option><option value="on_hold">On hold</option><option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div><label className="label">Notes</label><textarea className="input min-h-20" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Anything the team should know about this college…" /></div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={save}>{editId ? 'Save changes' : 'Add college'}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!ticketFor} onClose={() => setTicketFor(null)} title={`Raise a ticket for ${ticketFor?.name ?? ''}`} className="max-w-xl">
        <div className="space-y-3">
          <div><label className="label">Title *</label>
            <input autoFocus className="input" value={tk.title} onChange={(e) => setTk((s) => ({ ...s, title: e.target.value }))} placeholder="What needs to be done?" />
          </div>
          <div><label className="label">Description</label>
            <textarea className="input min-h-28" value={tk.description} onChange={(e) => setTk((s) => ({ ...s, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Priority</label>
              <select className="input" value={tk.priority} onChange={(e) => setTk((s) => ({ ...s, priority: e.target.value as TaskPriority }))}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Due date</label>
              <input type="date" className="input" value={tk.due} onChange={(e) => setTk((s) => ({ ...s, due: e.target.value }))} />
            </div>
          </div>
          {canAssign && (
            <div><label className="label">Assign to</label>
              <PersonPicker people={members} value={tk.assignee || undefined} allowUnassign
                onSelect={(email) => setTk((s) => ({ ...s, assignee: email }))} placeholder="Search team members…" />
              {tk.assignee && <label className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
                <input type="checkbox" checked={tk.notify} onChange={(e) => setTk((s) => ({ ...s, notify: e.target.checked }))} /> Email the assignee
              </label>}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setTicketFor(null)}>Cancel</Button>
            <Button loading={pending} onClick={submitTicket}>Create ticket</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
