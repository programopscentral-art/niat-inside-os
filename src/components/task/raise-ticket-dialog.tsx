'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PersonPicker } from '@/components/ui/person-picker';
import { useToast } from '@/components/ui/toast';
import { createTask } from '@/lib/actions/tasks';
import type { TaskPriority } from '@/lib/types';

export interface RaiseTeam { id: string; team_key: string; name: string; canAssign: boolean; canEmail: boolean; }

export function RaiseTicketDialog({ teams, label = 'Raise ticket' }: { teams: RaiseTeam[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [sheet, setSheet] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);

  const team = teams.find((t) => t.id === teamId);

  function reset() { setTitle(''); setDescription(''); setPriority('MEDIUM'); setAssignee(''); setDue(''); setSheet(''); setNotifyEmail(false); }

  function submit() {
    if (!teamId) { toast('Pick a team', 'error'); return; }
    start(async () => {
      const r = await createTask({ teamId, title, description, priority, assigneeEmail: assignee, dueDate: due, sheet_url: sheet, labels: [], notifyEmail });
      if (r.ok) { toast(`Created ${r.data?.tag}`, 'success'); setOpen(false); reset(); router.push(`/tasks/${r.data?.tag}`); }
      else toast(r.error, 'error');
    });
  }

  if (teams.length === 0) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Raise a ticket" className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="label">Team</label>
            <select className="input" value={teamId} onChange={(e) => { setTeamId(e.target.value); setAssignee(''); }}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.team_key} — {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Title *</label>
            <input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>
          <div>
            <label className="label">Description (markdown)</label>
            <textarea className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details, context, links…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Due date</label><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Sheet className="h-3.5 w-3.5" /> Google Sheet link (optional)</label>
            <input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/…" />
          </div>
          {team?.canAssign && (
            <div>
              <label className="label">Assign to (optional)</label>
              <PersonPicker orgSearch value={assignee || undefined} onSelect={setAssignee} placeholder="Search anyone by name/email…" />
            </div>
          )}
          {team?.canAssign && team?.canEmail && assignee && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} /> Email the assignee</label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={submit}>Create ticket</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
