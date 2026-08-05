'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser, isAdmin } from '@/lib/auth';
import { audit } from '@/lib/audit';

type Result = { ok: true } | { ok: false; error: string };

export async function setGlobalRole(userId: string, role: 'super_admin' | 'user'): Promise<Result> {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: 'Admins only.' };
  if (userId === user.id && role === 'user') return { ok: false, error: 'You cannot demote yourself.' };
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc('admin_set_global_role', { p_user: userId, p_role: role });
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'admin.set_role', entityType: 'user', entityId: userId, details: { role } });
  revalidatePath('/admin');
  return { ok: true };
}

export async function setUserStatus(userId: string, status: 'active' | 'suspended'): Promise<Result> {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: 'Admins only.' };
  if (userId === user.id) return { ok: false, error: 'You cannot suspend yourself.' };
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc('admin_set_user_status', { p_user: userId, p_status: status });
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'admin.set_status', entityType: 'user', entityId: userId, details: { status } });
  revalidatePath('/admin');
  return { ok: true };
}
