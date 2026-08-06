'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  employee_id: z.string().trim().max(40).optional().default(''),
  mobile: z.string().trim().max(40).optional().default(''),
  email: z.string().trim().max(160).optional().default(''),
  designation: z.string().trim().max(60).optional().default('')
});

async function collegeTeam(collegeId: string) {
  const supabase = createSupabaseServer();
  const { data } = await supabase.from('colleges').select('team_id').eq('id', collegeId).maybeSingle();
  return data?.team_id ?? null;
}

export async function addCollegePerson(collegeId: string, input: z.infer<typeof schema>): Promise<Result> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = createSupabaseServer();
  // RLS (can_manage_college) is the real gate; this insert fails cleanly if not allowed.
  const { error } = await supabase.from('college_people').insert({
    college_id: collegeId, name: v.name,
    employee_id: v.employee_id || null, mobile: v.mobile || null,
    email: v.email ? v.email.toLowerCase() : null, designation: v.designation || null
  });
  if (error) return { ok: false, error: 'You cannot add people to this college.' };

  const teamId = await collegeTeam(collegeId);
  await audit({ actorId: user.id, action: 'college.person.add', entityType: 'college', entityId: collegeId, teamId, details: { name: v.name } });
  revalidatePath('/teams');
  return { ok: true };
}

export async function deleteCollegePerson(personId: string): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: row } = await supabase.from('college_people').select('college_id').eq('id', personId).maybeSingle();
  const { error } = await supabase.from('college_people').delete().eq('id', personId);
  if (error) return { ok: false, error: 'Not allowed.' };
  const teamId = row ? await collegeTeam(row.college_id) : null;
  await audit({ actorId: user.id, action: 'college.person.remove', entityType: 'college_person', entityId: personId, teamId });
  revalidatePath('/teams');
  return { ok: true };
}
