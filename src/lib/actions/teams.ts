'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser, isAdmin, requireCap } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { resolveProfilesByEmail } from '@/lib/notify';

const teamSchema = z.object({
  team_key: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, 'Key must be 2–8 letters/numbers'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().default(''),
  manager_email: z.string().trim().email().toLowerCase().optional().or(z.literal(''))
});

type Result = { ok: true; data?: any } | { ok: false; error: string };

export async function createTeam(input: z.infer<typeof teamSchema>): Promise<Result> {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: 'Only a super admin can create teams.' };

  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { team_key, name, description, manager_email } = parsed.data;

  const supabase = createSupabaseServer();
  const { data: team, error } = await supabase
    .from('teams')
    .insert({ team_key, name, description, created_by: user.id })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Team key "${team_key}" is already taken.` };
    return { ok: false, error: error.message };
  }

  // Optionally appoint a manager (must have signed in at least once).
  if (manager_email) {
    const [mgr] = await resolveProfilesByEmail([manager_email]);
    if (!mgr) {
      await audit({ actorId: user.id, action: 'team.create', entityType: 'team', entityId: team.id, teamId: team.id, details: { team_key, name, manager_email, manager_pending: true } });
      revalidatePath('/admin'); revalidatePath('/teams');
      return { ok: true, data: { team, warning: `Team created. ${manager_email} must sign in once before they can be made manager.` } };
    }
    await supabase.from('team_members').insert({
      team_id: team.id, user_id: mgr.id, team_role: 'manager', status: 'active', invited_by: user.id
    });
  }

  await audit({ actorId: user.id, action: 'team.create', entityType: 'team', entityId: team.id, teamId: team.id, details: { team_key, name } });
  revalidatePath('/admin'); revalidatePath('/teams'); revalidatePath('/dashboard');
  return { ok: true, data: { team } };
}

export async function assignManager(teamId: string, email: string): Promise<Result> {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: 'Only a super admin can appoint managers.' };
  const em = email.trim().toLowerCase();

  const [mgr] = await resolveProfilesByEmail([em]);
  if (!mgr) return { ok: false, error: `${em} must sign in once before being appointed.` };

  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from('team_members')
    .upsert({ team_id: teamId, user_id: mgr.id, team_role: 'manager', status: 'active', invited_by: user.id },
            { onConflict: 'team_id,user_id' });
  if (error) return { ok: false, error: error.message };

  await audit({ actorId: user.id, action: 'team.assign_manager', entityType: 'team', entityId: teamId, teamId, details: { email: em } });
  revalidatePath('/admin');
  return { ok: true };
}

export async function archiveTeam(teamId: string): Promise<Result> {
  const user = await requireUser();
  if (!isAdmin(user)) {
    try { await requireCap(teamId, 'MANAGE_TEAM'); } catch { return { ok: false, error: 'Not allowed.' }; }
  }
  const supabase = createSupabaseServer();
  const { error } = await supabase.from('teams').update({ status: 'archived' }).eq('id', teamId);
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'team.archive', entityType: 'team', entityId: teamId, teamId });
  revalidatePath('/admin'); revalidatePath('/teams');
  return { ok: true };
}
