'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser, requireCap, canCap } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify, resolveProfilesByEmail } from '@/lib/notify';
import { safeUrl } from '@/lib/utils';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const createSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().trim().min(2, 'Title is required').max(160),
  description: z.string().trim().max(8000).optional().default(''),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeEmail: z.string().trim().toLowerCase().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  labels: z.array(z.string().trim()).max(12).default([]),
  sheet_url: z.string().trim().max(600).optional().or(z.literal('')),
  notifyEmail: z.boolean().default(false)
});

export async function createTask(input: z.infer<typeof createSchema>): Promise<Result<{ tag: string; id: string }>> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  try { await requireCap(v.teamId, 'CREATE_TASK'); } catch { return { ok: false, error: 'You cannot create tasks in this team.' }; }

  let assigneeId: string | null = null;
  if (v.assigneeEmail) {
    if (!(await canCap(v.teamId, 'ASSIGN_TASK'))) return { ok: false, error: 'You cannot assign tasks in this team.' };
    const [p] = await resolveProfilesByEmail([v.assigneeEmail]);
    if (!p) return { ok: false, error: `${v.assigneeEmail} must sign in once before being assigned.` };
    assigneeId = p.id;
  }

  const supabase = createSupabaseServer();
  const { data: task, error } = await supabase.from('tasks').insert({
    team_id: v.teamId, title: v.title, description: v.description || null,
    priority: v.priority, assignee_id: assigneeId,
    due_date: v.dueDate || null, labels: v.labels, sheet_url: safeUrl(v.sheet_url), created_by: user.id
  }).select('id, tag, team_id').single();
  if (error) return { ok: false, error: error.message };

  if (assigneeId) {
    await supabase.from('task_watchers').upsert({ task_id: task.id, user_id: assigneeId, added_by: user.id }, { onConflict: 'task_id,user_id' });
    if (assigneeId !== user.id) {
      await notify({
        recipientId: assigneeId, type: 'assigned', teamId: v.teamId, taskId: task.id, taskTag: task.tag,
        email: v.notifyEmail && (await canCap(v.teamId, 'SEND_EMAIL')),
        title: `Assigned: ${task.tag} — ${v.title}`,
        body: `${user.profile.full_name || user.email} assigned you ${task.tag}.`
      });
    }
  }

  await audit({ actorId: user.id, action: 'task.create', entityType: 'task', entityId: task.id, teamId: v.teamId, details: { tag: task.tag } });
  revalidatePath('/teams'); revalidatePath('/dashboard');
  return { ok: true, data: { tag: task.tag, id: task.id } };
}

const patchSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(8000).optional(),
  remarks: z.string().trim().max(2000).optional(),
  due_date: z.string().nullable().optional(),
  labels: z.array(z.string().trim()).max(12).optional(),
  sheet_url: z.string().trim().max(600).nullable().optional()
});

export async function updateTask(taskId: string, patch: z.infer<typeof patchSchema>): Promise<Result> {
  const user = await requireUser();
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = createSupabaseServer();
  const { data: task } = await supabase.from('tasks').select('id, team_id, tag, assignee_id, status').eq('id', taskId).maybeSingle();
  if (!task) return { ok: false, error: 'Task not found or access denied.' };

  // Closing/cancelling needs CLOSE_TASK.
  if ((parsed.data.status === 'DONE' || parsed.data.status === 'CANCELLED')) {
    if (!(await canCap(task.team_id, 'CLOSE_TASK'))) return { ok: false, error: 'You cannot close tasks in this team.' };
  }
  const clean = { ...parsed.data };
  if (parsed.data.status === 'DONE') (clean as any).progress = 100;
  if ('sheet_url' in parsed.data) (clean as any).sheet_url = safeUrl(parsed.data.sheet_url);

  const { error } = await supabase.from('tasks').update(clean).eq('id', taskId);
  if (error) return { ok: false, error: 'Not permitted or invalid update.' };

  // Notify assignee of status changes made by someone else.
  if (parsed.data.status && task.assignee_id && task.assignee_id !== user.id) {
    await notify({
      recipientId: task.assignee_id, type: 'status_change', teamId: task.team_id, taskId, taskTag: task.tag,
      title: `${task.tag} → ${parsed.data.status}`,
      body: `${user.profile.full_name || user.email} changed the status of ${task.tag}.`
    });
  }

  await audit({ actorId: user.id, action: 'task.update', entityType: 'task', entityId: taskId, teamId: task.team_id, details: parsed.data });
  revalidatePath('/teams'); revalidatePath(`/tasks/${task.tag}`); revalidatePath('/dashboard');
  return { ok: true };
}

export async function assignTask(taskId: string, assigneeEmail: string, notifyEmail = false): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: task } = await supabase.from('tasks').select('id, team_id, tag, title').eq('id', taskId).maybeSingle();
  if (!task) return { ok: false, error: 'Task not found.' };
  try { await requireCap(task.team_id, 'ASSIGN_TASK'); } catch { return { ok: false, error: 'You cannot assign tasks in this team.' }; }

  const em = assigneeEmail.trim().toLowerCase();
  const [p] = await resolveProfilesByEmail([em]);
  if (!p) return { ok: false, error: `${em} must sign in once before being assigned.` };

  const { error } = await supabase.from('tasks').update({ assignee_id: p.id }).eq('id', taskId);
  if (error) return { ok: false, error: error.message };
  await supabase.from('task_watchers').upsert({ task_id: taskId, user_id: p.id, added_by: user.id }, { onConflict: 'task_id,user_id' });

  if (p.id !== user.id) {
    await notify({
      recipientId: p.id, type: 'assigned', teamId: task.team_id, taskId, taskTag: task.tag,
      email: notifyEmail && (await canCap(task.team_id, 'SEND_EMAIL')),
      title: `Assigned: ${task.tag} — ${task.title}`,
      body: `${user.profile.full_name || user.email} assigned you ${task.tag}.`
    });
  }
  await audit({ actorId: user.id, action: 'task.assign', entityType: 'task', entityId: taskId, teamId: task.team_id, details: { assignee: em } });
  revalidatePath(`/tasks/${task.tag}`); revalidatePath('/teams');
  return { ok: true };
}

/** Add a watcher by email — the mechanism for cross-team tagging. */
export async function addWatcher(taskId: string, email: string, notifyEmail = false): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: task } = await supabase.from('tasks').select('id, team_id, tag, title').eq('id', taskId).maybeSingle();
  if (!task) return { ok: false, error: 'Task not found.' };

  const canAssign = await canCap(task.team_id, 'ASSIGN_TASK');
  const { data: mine } = await supabase.from('tasks').select('created_by').eq('id', taskId).single();
  if (!canAssign && mine?.created_by !== user.id) return { ok: false, error: 'You cannot add watchers to this task.' };

  const em = email.trim().toLowerCase();
  const [p] = await resolveProfilesByEmail([em]);
  if (!p) return { ok: false, error: `${em} must sign in once before being tagged.` };

  const { error } = await supabase.from('task_watchers').upsert({ task_id: taskId, user_id: p.id, added_by: user.id }, { onConflict: 'task_id,user_id' });
  if (error) return { ok: false, error: error.message };

  if (p.id !== user.id) {
    await notify({
      recipientId: p.id, type: 'tagged', teamId: task.team_id, taskId, taskTag: task.tag, email: notifyEmail,
      title: `You were tagged on ${task.tag}`,
      body: `${user.profile.full_name || user.email} tagged you on ${task.tag} — ${task.title}.`
    });
  }
  await audit({ actorId: user.id, action: 'task.watch', entityType: 'task', entityId: taskId, teamId: task.team_id, details: { email: em } });
  revalidatePath(`/tasks/${task.tag}`);
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: task } = await supabase.from('tasks').select('team_id, tag').eq('id', taskId).maybeSingle();
  if (!task) return { ok: false, error: 'Task not found.' };
  try { await requireCap(task.team_id, 'DELETE_TASK'); } catch { return { ok: false, error: 'You cannot delete tasks.' }; }
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'task.delete', entityType: 'task', entityId: taskId, teamId: task.team_id, details: { tag: task.tag } });
  revalidatePath('/teams');
  return { ok: true };
}
