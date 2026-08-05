'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser, requireCap } from '@/lib/auth';
import { audit } from '@/lib/audit';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(1, 'College name is required').max(120),
  city: z.string().trim().max(80).optional().default(''),
  caretaker_name: z.string().trim().max(120).optional().default(''),
  caretaker_email: z.string().trim().max(160).optional().default(''),
  caretaker_phone: z.string().trim().max(40).optional().default(''),
  designation: z.string().trim().max(60).optional().default(''),
  employee_id: z.string().trim().max(40).optional().default(''),
  status: z.enum(['active', 'on_hold', 'closed']).default('active'),
  notes: z.string().trim().max(2000).optional().default('')
});

const clean = (v: z.infer<typeof schema>) => ({
  name: v.name,
  city: v.city || null,
  caretaker_name: v.caretaker_name || null,
  caretaker_email: v.caretaker_email ? v.caretaker_email.toLowerCase() : null,
  caretaker_phone: v.caretaker_phone || null,
  designation: v.designation || null,
  employee_id: v.employee_id || null,
  status: v.status,
  notes: v.notes || null
});

export async function createCollege(teamId: string, input: z.infer<typeof schema>): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  try { await requireCap(teamId, 'MANAGE_COLLEGES'); } catch { return { ok: false, error: 'You cannot manage colleges for this team.' }; }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from('colleges').insert({ team_id: teamId, created_by: user.id, ...clean(parsed.data) })
    .select('id').single();
  if (error) return { ok: false, error: error.message };

  await audit({ actorId: user.id, action: 'college.create', entityType: 'college', entityId: data.id, teamId, details: { name: parsed.data.name } });
  revalidatePath(`/teams`);
  return { ok: true, data: { id: data.id } };
}

export async function updateCollege(collegeId: string, input: z.infer<typeof schema>): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: row } = await supabase.from('colleges').select('team_id').eq('id', collegeId).maybeSingle();
  if (!row) return { ok: false, error: 'College not found.' };
  try { await requireCap(row.team_id, 'MANAGE_COLLEGES'); } catch { return { ok: false, error: 'Not allowed.' }; }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase.from('colleges').update(clean(parsed.data)).eq('id', collegeId);
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'college.update', entityType: 'college', entityId: collegeId, teamId: row.team_id });
  revalidatePath(`/teams`);
  return { ok: true };
}

export async function deleteCollege(collegeId: string): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: row } = await supabase.from('colleges').select('team_id').eq('id', collegeId).maybeSingle();
  if (!row) return { ok: false, error: 'College not found.' };
  try { await requireCap(row.team_id, 'MANAGE_COLLEGES'); } catch { return { ok: false, error: 'Not allowed.' }; }
  const { error } = await supabase.from('colleges').delete().eq('id', collegeId);
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'college.delete', entityType: 'college', entityId: collegeId, teamId: row.team_id });
  revalidatePath(`/teams`);
  return { ok: true };
}
