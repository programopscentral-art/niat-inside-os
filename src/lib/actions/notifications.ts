'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

type Result = { ok: true } | { ok: false; error: string };

export async function markRead(id: string): Promise<Result> {
  await requireUser();
  const supabase = createSupabaseServer();
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/notifications');
  return { ok: true };
}

export async function markAllRead(): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/notifications');
  return { ok: true };
}
