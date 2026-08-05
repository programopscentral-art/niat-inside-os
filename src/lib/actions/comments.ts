'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, canCap } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify, resolveProfilesByEmail } from '@/lib/notify';
import { extractMentions } from '@/lib/utils';

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1, 'Say something').max(4000),
  notifyEmail: z.boolean().default(false)
});

export async function addComment(input: z.infer<typeof schema>): Promise<Result> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { taskId, body, notifyEmail } = parsed.data;

  const supabase = createSupabaseServer();
  const { data: task } = await supabase.from('tasks').select('id, team_id, tag').eq('id', taskId).maybeSingle();
  if (!task) return { ok: false, error: 'Task not found or access denied.' };

  const { data: comment, error } = await supabase.from('comments')
    .insert({ task_id: taskId, team_id: task.team_id, author_id: user.id, body })
    .select('id').single();
  if (error) return { ok: false, error: 'You cannot comment on this task.' };

  // Handle @mentions — mentioned users become watchers (cross-team access to
  // THIS task only) and get notified. Watcher inserts use the service role
  // because the mentioned user may be outside the team (already authorized:
  // the actor can view/comment on the task).
  const mentions = extractMentions(body);
  const canEmail = notifyEmail && (await canCap(task.team_id, 'SEND_EMAIL'));
  if (mentions.length) {
    const profiles = await resolveProfilesByEmail(mentions);
    const admin = createSupabaseAdmin();
    for (const p of profiles) {
      await admin.from('task_watchers').upsert({ task_id: taskId, user_id: p.id, added_by: user.id }, { onConflict: 'task_id,user_id' });
      await admin.from('mentions').insert({ comment_id: comment.id, mentioned_user_id: p.id });
      if (p.id !== user.id) {
        await notify({
          recipientId: p.id, type: 'mention', teamId: task.team_id, taskId, taskTag: task.tag, email: canEmail,
          title: `Mentioned on ${task.tag}`,
          body: `${user.profile.full_name || user.email} mentioned you: "${body.slice(0, 140)}"`
        });
      }
    }
  }

  // Notify existing watchers (excluding the author and already-notified mentions).
  const { data: watchers } = await supabase.from('task_watchers').select('user_id').eq('task_id', taskId);
  const notified = new Set(mentions);
  for (const w of watchers ?? []) {
    if (w.user_id === user.id) continue;
    await notify({
      recipientId: w.user_id, type: 'comment', teamId: task.team_id, taskId, taskTag: task.tag,
      title: `New comment on ${task.tag}`,
      body: `${user.profile.full_name || user.email}: "${body.slice(0, 140)}"`
    });
  }

  await audit({ actorId: user.id, action: 'comment.add', entityType: 'task', entityId: taskId, teamId: task.team_id });
  revalidatePath(`/tasks/${task.tag}`);
  return { ok: true };
}
