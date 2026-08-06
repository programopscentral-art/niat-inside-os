'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Tag, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { PersonPicker } from '@/components/ui/person-picker';
import { useToast } from '@/components/ui/toast';
import { updateTask, assignTask, addWatcher } from '@/lib/actions/tasks';
import { TASK_STATUS_ALL } from '@/lib/board-const';
import type { Task, TaskStatus, TaskPriority } from '@/lib/types';

interface Member { email: string; full_name: string | null; }
interface Person { full_name: string | null; email: string; avatar_url: string | null; }

export function TaskSidebar({ task, caps, members, watchers, assignee, currentUserId }:
  { task: Task; caps: string[]; members: Member[]; watchers: Person[]; assignee: Person | null; currentUserId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const has = (c: string) => caps.includes(c);
  const canEdit = has('EDIT_ANY_TASK') || (has('EDIT_OWN_TASK') && (task.created_by === currentUserId || task.assignee_id === currentUserId));

  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [progress, setProgress] = useState(task.progress);
  const [due, setDue] = useState(task.due_date ?? '');
  const [remarks, setRemarks] = useState(task.remarks ?? '');
  const [sheet, setSheet] = useState(task.sheet_url ?? '');
  const [emailOnTag, setEmailOnTag] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) { toast(okMsg, 'success'); router.refresh(); }
      else toast(r.error || 'Something went wrong', 'error');
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} disabled={!canEdit}
            onChange={(e) => { const v = e.target.value as TaskStatus; setStatus(v); run(() => updateTask(task.id, { status: v }), `Status → ${v}`); }}>
            {TASK_STATUS_ALL.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={priority} disabled={!canEdit}
            onChange={(e) => { const v = e.target.value as TaskPriority; setPriority(v); run(() => updateTask(task.id, { priority: v }), 'Priority updated'); }}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Progress — {progress}%</label>
          <input type="range" min={0} max={100} step={5} value={progress} disabled={!canEdit}
            className="w-full accent-[hsl(var(--primary))]"
            onChange={(e) => setProgress(Number(e.target.value))}
            onMouseUp={() => canEdit && run(() => updateTask(task.id, { progress }), 'Progress saved')}
            onTouchEnd={() => canEdit && run(() => updateTask(task.id, { progress }), 'Progress saved')} />
        </div>
        <div>
          <label className="label">Due date</label>
          <input type="date" className="input" value={due} disabled={!canEdit}
            onChange={(e) => { setDue(e.target.value); run(() => updateTask(task.id, { due_date: e.target.value || null }), 'Due date updated'); }} />
        </div>
        <div>
          <label className="label">Google Sheet link</label>
          <input className="input" value={sheet} disabled={!canEdit}
            placeholder="https://docs.google.com/spreadsheets/…"
            onChange={(e) => setSheet(e.target.value)}
            onBlur={() => canEdit && sheet !== (task.sheet_url ?? '') && run(() => updateTask(task.id, { sheet_url: sheet }), 'Sheet link saved')} />
        </div>
      </div>

      <div className="card p-4">
        <label className="label">Remarks</label>
        <textarea className="input min-h-20" value={remarks} disabled={!canEdit}
          onChange={(e) => setRemarks(e.target.value)} placeholder="Status notes, blockers, how much is done…" />
        {canEdit && (
          <Button size="sm" variant="outline" className="mt-2" loading={pending}
            onClick={() => run(() => updateTask(task.id, { remarks }), 'Remarks saved')}>
            <Save className="h-3.5 w-3.5" /> Save remarks
          </Button>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <label className="label">Assignee</label>
        <div className="flex items-center gap-2">
          {assignee ? <Avatar name={assignee.full_name} email={assignee.email} src={assignee.avatar_url} size={28} /> : <span className="chip">Unassigned</span>}
          {assignee && <span className="text-sm">{assignee.full_name || assignee.email}</span>}
        </div>
        {has('ASSIGN_TASK') && (
          <PersonPicker people={members} placeholder="Reassign to…"
            onSelect={(email) => email && run(() => assignTask(task.id, email, false), 'Reassigned')} />
        )}
      </div>

      <div className="card p-4 space-y-3">
        <label className="label flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Watchers (cross-team tagging)</label>
        <div className="flex flex-wrap gap-1.5">
          {watchers.length === 0 && <span className="text-xs text-fg-muted">No watchers yet.</span>}
          {watchers.map((w) => <span key={w.email} className="chip"><Avatar name={w.full_name} email={w.email} size={16} /> {w.full_name || w.email}</span>)}
        </div>
        {(has('ASSIGN_TASK') || task.created_by === currentUserId) && (
          <div className="space-y-2">
            <PersonPicker orgSearch placeholder="Tag anyone by name or email…"
              onSelect={(email) => email && run(() => addWatcher(task.id, email, emailOnTag), 'Tagged')} />
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <input type="checkbox" checked={emailOnTag} onChange={(e) => setEmailOnTag(e.target.checked)} /> Email people I tag
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
