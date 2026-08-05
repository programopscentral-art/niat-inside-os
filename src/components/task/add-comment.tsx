'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersonPicker } from '@/components/ui/person-picker';
import { useToast } from '@/components/ui/toast';
import { addComment } from '@/lib/actions/comments';

export function AddComment({ taskId, canEmail }: { taskId: string; canEmail: boolean }) {
  const [body, setBody] = useState('');
  const [email, setEmail] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const r = await addComment({ taskId, body, notifyEmail: email });
      if (r.ok) { setBody(''); setEmail(false); toast('Comment posted', 'success'); router.refresh(); }
      else toast(r.error, 'error');
    });
  }

  function mention(em: string) {
    if (!em) return;
    setBody((b) => (b.trim() ? b.replace(/\s*$/, ' ') : '') + `@${em} `);
  }

  return (
    <div className="card p-3">
      <textarea className="input min-h-20 resize-y" value={body} onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment. Mention anyone to give them access to this ticket." />
      <div className="mt-2">
        <PersonPicker orgSearch placeholder="@ Mention someone…" onSelect={mention} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        {canEmail ? (
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email mentioned people
          </label>
        ) : <span />}
        <Button size="sm" loading={pending} onClick={submit}><Send className="h-3.5 w-3.5" /> Comment</Button>
      </div>
    </div>
  );
}
