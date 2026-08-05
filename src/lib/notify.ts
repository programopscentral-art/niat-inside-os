import 'server-only';
import { createSupabaseAdmin } from './supabase/admin';
import { queueEmail, emailShell } from './email';
import { PUBLIC_ENV } from './env';

interface NotifyInput {
  recipientId: string;
  type: string;
  title: string;
  body?: string;
  taskId?: string | null;
  teamId?: string | null;
  taskTag?: string | null;
  email?: boolean;
}

/**
 * Create an in-app notification for a user, and (optionally) queue an email.
 * Uses the service-role client because the recipient is usually not the actor
 * — callers MUST have authorized the action first.
 */
export async function notify(input: NotifyInput) {
  const admin = createSupabaseAdmin();

  await admin.from('notifications').insert({
    recipient_id: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    task_id: input.taskId ?? null,
    team_id: input.teamId ?? null
  });

  if (input.email) {
    const { data: profile } = await admin
      .from('profiles').select('email').eq('id', input.recipientId).maybeSingle();
    if (profile?.email) {
      const link = input.taskTag
        ? `${PUBLIC_ENV.APP_URL}/tasks/${input.taskTag}`
        : `${PUBLIC_ENV.APP_URL}/dashboard`;
      await queueEmail(
        profile.email,
        input.title,
        emailShell(input.title, (input.body || '').replace(/\n/g, '<br>'), link, 'Open in NIAT Inside OS')
      );
    }
  }
}

/** Resolve emails to profile ids (only users who have logged in exist). */
export async function resolveProfilesByEmail(emails: string[]) {
  if (!emails.length) return [] as { id: string; email: string }[];
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from('profiles')
    .select('id, email')
    .in('email', emails.map((e) => e.toLowerCase()));
  return data ?? [];
}
