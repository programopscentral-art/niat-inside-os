'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser, requireCap } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify, resolveProfilesByEmail } from '@/lib/notify';
import { ROLE_CAPS, type TeamRole, type Cap } from '@/lib/capabilities';

type Result = { ok: true } | { ok: false; error: string };

const roleEnum = z.enum(['manager', 'lead', 'member', 'viewer']);

function trimExtras(role: TeamRole, extras: string[]) {
  const defaults = new Set(ROLE_CAPS[role] as Cap[]);
  return extras.filter((c) => !defaults.has(c as Cap));
}

export async function addMember(teamId: string, email: string, role: TeamRole, extraCaps: string[] = []): Promise<Result> {
  const user = await requireUser();
  try { await requireCap(teamId, 'MANAGE_MEMBERS'); } catch { return { ok: false, error: 'Not allowed to manage members.' }; }

  const em = z.string().email().safeParse(email.trim().toLowerCase());
  if (!em.success) return { ok: false, error: 'Invalid email.' };
  if (!roleEnum.safeParse(role).success) return { ok: false, error: 'Invalid role.' };

  const [profile] = await resolveProfilesByEmail([em.data]);
  if (!profile) return { ok: false, error: `${em.data} must sign in once before being added.` };

  const supabase = createSupabaseServer();
  const { error } = await supabase.from('team_members').upsert(
    { team_id: teamId, user_id: profile.id, team_role: role, permissions: trimExtras(role, extraCaps), status: 'active', invited_by: user.id },
    { onConflict: 'team_id,user_id' }
  );
  if (error) return { ok: false, error: error.message };

  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();
  await notify({ recipientId: profile.id, type: 'added_to_team', teamId, title: `Added to ${team?.name}`, body: `You were added to ${team?.name} as ${role}.` });
  await audit({ actorId: user.id, action: 'member.add', entityType: 'team', entityId: teamId, teamId, details: { email: em.data, role } });
  revalidatePath(`/teams`);
  return { ok: true };
}

export async function updateMember(membershipId: string, role: TeamRole, extraCaps: string[]): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: mem } = await supabase.from('team_members').select('team_id, user_id').eq('id', membershipId).maybeSingle();
  if (!mem) return { ok: false, error: 'Membership not found.' };
  try { await requireCap(mem.team_id, 'MANAGE_MEMBERS'); } catch { return { ok: false, error: 'Not allowed.' }; }
  if (!roleEnum.safeParse(role).success) return { ok: false, error: 'Invalid role.' };

  const { error } = await supabase.from('team_members')
    .update({ team_role: role, permissions: trimExtras(role, extraCaps) })
    .eq('id', membershipId);
  if (error) return { ok: false, error: error.message };

  await audit({ actorId: user.id, action: 'member.update', entityType: 'membership', entityId: membershipId, teamId: mem.team_id, details: { role, extraCaps } });
  revalidatePath(`/teams`);
  return { ok: true };
}

export async function removeMember(membershipId: string): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: mem } = await supabase.from('team_members').select('team_id').eq('id', membershipId).maybeSingle();
  if (!mem) return { ok: false, error: 'Membership not found.' };
  try { await requireCap(mem.team_id, 'MANAGE_MEMBERS'); } catch { return { ok: false, error: 'Not allowed.' }; }

  const { error } = await supabase.from('team_members').update({ status: 'removed' }).eq('id', membershipId);
  if (error) return { ok: false, error: error.message };
  await audit({ actorId: user.id, action: 'member.remove', entityType: 'membership', entityId: membershipId, teamId: mem.team_id });
  revalidatePath(`/teams`);
  return { ok: true };
}
