'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PersonPicker } from '@/components/ui/person-picker';
import { useToast } from '@/components/ui/toast';
import { createTask } from '@/lib/actions/tasks';
import type { TaskPriority } from '@/lib/types';

interface Member { email: string; full_name: string | null; }

export function CreateTaskDialog({ teamId, members, canAssign, canEmail }:
  { teamId: string; members: Member[]; canAssign: boolean; canEmail: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [labels, setLabels] = useState('');
  const [sheet, setSheet] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);

  function reset() { setTitle(''); setDescription(''); setPriority('MEDIUM'); setAssignee(''); setDue(''); setLabels(''); setSheet(''); setNotifyEmail(false); }

  function submit() {
    start(async () => {
      const r = await createTask({
        teamId, title, description, priority,
        assigneeEmail: assignee, dueDate: due,
        labels: labels.split(',').map((s) => s.trim()).filter(Boolean),
        sheet_url: sheet,
        notifyEmail
      });
      if (r.ok) {
        toast(`Created ${r.data?.tag}`, 'success');
        setOpen(false); reset(); router.refresh();
      } else toast(r.error, 'error');
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New task</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Create task / ticket" className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short, clear summary" />
          </div>
          <div>
            <label className="label">Description (markdown supported)</label>
            <textarea className="input min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details, acceptance criteria, links…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          {canAssign && (
            <div>
              <label className="label">Assignee</label>
              <PersonPicker people={members} value={assignee} allowUnassign
                onSelect={setAssignee} placeholder="Search team members…" />
            </div>
          )}
          <div>
            <label className="label">Labels (comma-separated)</label>
            <input className="input" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="frontend, urgent, q3" />
          </div>
          <div>
            <label className="label">Google Sheet link (optional)</label>
            <input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/…" />
          </div>
          {canAssign && canEmail && assignee && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
              Email the assignee about this task
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={submit}>Create task</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
