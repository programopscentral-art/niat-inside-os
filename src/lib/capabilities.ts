// Client/server mirror of the DB capability model (see supabase/migrations).
// The database is the source of truth (has_cap); this mirror drives the UI.

export const CAPS = [
  'VIEW_TEAM', 'CREATE_TASK', 'ASSIGN_TASK', 'EDIT_OWN_TASK', 'EDIT_ANY_TASK',
  'CLOSE_TASK', 'DELETE_TASK', 'COMMENT', 'SEND_EMAIL', 'MANAGE_MEMBERS',
  'APPROVE_JOIN', 'MANAGE_TEAM', 'MANAGE_COLLEGES'
] as const;

export type Cap = (typeof CAPS)[number];

export const CAP_LABELS: Record<Cap, string> = {
  VIEW_TEAM: 'View team tasks',
  CREATE_TASK: 'Create tasks',
  ASSIGN_TASK: 'Assign & tag people',
  EDIT_OWN_TASK: 'Edit own tasks',
  EDIT_ANY_TASK: 'Edit any task',
  CLOSE_TASK: 'Close / cancel tasks',
  DELETE_TASK: 'Delete tasks',
  COMMENT: 'Comment',
  SEND_EMAIL: 'Send email notifications',
  MANAGE_MEMBERS: 'Manage members & permissions',
  APPROVE_JOIN: 'Approve join requests',
  MANAGE_TEAM: 'Manage team settings',
  MANAGE_COLLEGES: 'Manage college assignments'
};

export type TeamRole = 'manager' | 'lead' | 'member' | 'viewer';

export const ROLE_CAPS: Record<TeamRole, Cap[]> = {
  manager: [...CAPS],
  lead: ['VIEW_TEAM', 'CREATE_TASK', 'ASSIGN_TASK', 'EDIT_OWN_TASK', 'EDIT_ANY_TASK', 'CLOSE_TASK', 'COMMENT', 'SEND_EMAIL'],
  member: ['VIEW_TEAM', 'CREATE_TASK', 'EDIT_OWN_TASK', 'COMMENT', 'SEND_EMAIL'],
  viewer: ['VIEW_TEAM', 'COMMENT']
};

export const ROLE_LABELS: Record<TeamRole, string> = {
  manager: 'Manager', lead: 'Lead', member: 'Member', viewer: 'Viewer'
};

/** Effective caps = role defaults ∪ extra granted permissions. */
export function effectiveCaps(role: TeamRole, extra: string[] = []): Set<Cap> {
  return new Set<Cap>([...ROLE_CAPS[role], ...(extra as Cap[])]);
}
