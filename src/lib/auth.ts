import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from './supabase/server';
import type { Profile, Team, Membership } from './types';
import type { Cap } from './capabilities';

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

/**
 * Returns the current user + profile, or null if not signed in.
 * Wrapped in React cache() so the auth check + profile fetch run ONCE per
 * request even though the layout and the page both call it.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;
  return { id: user.id, email: user.email!, profile: profile as Profile };
});

/** Require a signed-in user or redirect to sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect('/sign-in');
  if (u.profile.status === 'suspended') redirect('/suspended');
  return u;
}

/** Teams the current user is an active member of, with the membership row. */
export const getMyTeams = cache(async (): Promise<Array<Team & { membership: Membership }>> => {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('team_members')
    .select('*, teams(*)')
    .eq('status', 'active');
  if (!data) return [];
  return data
    .filter((m: any) => m.teams)
    .map((m: any) => ({ ...(m.teams as Team), membership: m as Membership }));
});

/** Server-side capability check that defers to the DB has_cap() function. */
export async function canCap(teamId: string, cap: Cap): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc('has_cap', { p_team: teamId, p_cap: cap });
  if (error) return false;
  return data === true;
}

export async function requireCap(teamId: string, cap: Cap) {
  if (!(await canCap(teamId, cap))) {
    throw new Error('FORBIDDEN: missing capability ' + cap);
  }
}

export function isAdmin(u: SessionUser) {
  return u.profile.global_role === 'super_admin';
}
