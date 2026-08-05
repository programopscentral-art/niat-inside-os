'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUser, requireCap } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { ROLE_CAPS, type TeamRole, type Cap } from '@/lib/capabilities';

type Result = { ok: true } | { ok: false; error: string };

export async function requestJoin(teamId: string, message: string): Promise<Result> {
  const user = await requireUser();
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase
    .from('team_members').select('id').eq('team_id', teamId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (existing) return { ok: false, error: 'You are already a member of this team.' };

  const { error } = await supabase
    .from('join_requests')
    .insert({ team_id: teamId, user_id: user.id, message: message.trim().slice(0, 500) });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'You already have a pending request for this team.' };
    return { ok: false, error: error.message };
  }

  // Notify approvers (managers) of the team.
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();
  const { data: approvers } = await supabase
    .from('team_members').select('user_id, team_role').eq('team_id', teamId).eq('status', 'active');
  for (const a of approvers ?? []) {
    if (a.team_role === 'manager' || a.team_role === 'lead') {
      await notify({
        recipientId: a.user_id, type: 'join_request', teamId,
        title: 'New join request',
        body: `${user.profile.full_name || user.email} requested to join ${team?.name ?? 'your team'}.`
      });
    }
  }

  await audit({ actorId: user.id, action: 'join.request', entityType: 'team', entityId: teamId, teamId });
  revalidatePath('/teams');
  return { ok: true };
}

const decideSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  role: z.enum(['manager', 'lead', 'member', 'viewer']).default('member'),
  extraCaps: z.array(z.string()).default([]),
  email: z.boolean().default(false)
});

export async function decideJoinRequest(input: z.infer<typeof decideSchema>): Promise<Result> {
  const user = await requireUser();
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { requestId, approve, role, extraCaps, email } = parsed.data;

  const supabase = createSupabaseServer();
  const { data: reqRow } = await supabase
    .from('join_requests').select('*').eq('id', requestId).maybeSingle();
  if (!reqRow) return { ok: false, error: 'Request not found.' };

  try { await requireCap(reqRow.team_id, 'APPROVE_JOIN'); }
  catch { return { ok: false, error: 'You cannot approve requests for this team.' }; }

  const { error: upErr } = await supabase
    .from('join_requests')
    .update({ status: approve ? 'approved' : 'rejected', decided_by: user.id, decided_at: new Date().toISOString() })
    .eq('id', requestId);
  if (upErr) return { ok: false, error: upErr.message };

  const { data: team } = await supabase.from('teams').select('name').eq('id', reqRow.team_id).single();

  if (approve) {
    // Only keep extra caps that aren't already role defaults.
    const defaults = new Set(ROLE_CAPS[role as TeamRole] as Cap[]);
    const extras = extraCaps.filter((c) => !defaults.has(c as Cap));
    const { error: memErr } = await supabase.from('team_members').upsert(
      { team_id: reqRow.team_id, user_id: reqRow.user_id, team_role: role, permissions: extras, status: 'active', invited_by: user.id },
      { onConflict: 'team_id,user_id' }
    );
    if (memErr) return { ok: false, error: memErr.message };
  }

  await notify({
    recipientId: reqRow.user_id, type: 'join_decided', teamId: reqRow.team_id, email,
    title: approve ? `You joined ${team?.name}` : `Join request declined`,
    body: approve
      ? `Your request to join ${team?.name} was approved as ${role}.`
      : `Your request to join ${team?.name} was declined.`
  });

  await audit({ actorId: user.id, action: approve ? 'join.approve' : 'join.reject', entityType: 'join_request', entityId: requestId, teamId: reqRow.team_id, details: { role } });
  revalidatePath('/teams');
  return { ok: true };
}
