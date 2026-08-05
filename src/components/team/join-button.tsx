'use client';
import { useState, useTransition } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { requestJoin } from '@/lib/actions/join';

export function JoinButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function submit() {
    start(async () => {
      const r = await requestJoin(teamId, msg);
      if (r.ok) { toast('Request sent — a manager will review it.', 'success'); setOpen(false); setMsg(''); }
      else toast(r.error, 'error');
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Request to join</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Request to join ${teamName}`}>
        <label className="label">Message to the manager (optional)</label>
        <textarea className="input min-h-24" value={msg} onChange={(e) => setMsg(e.target.value)}
          placeholder="Why would you like to join this team?" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} onClick={submit}>Send request</Button>
        </div>
      </Dialog>
    </>
  );
}
