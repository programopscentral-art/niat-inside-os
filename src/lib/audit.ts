import 'server-only';
import { createSupabaseAdmin } from './supabase/admin';

export async function audit(params: {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  teamId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const admin = createSupabaseAdmin();
    await admin.from('audit_log').insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      team_id: params.teamId ?? null,
      details: params.details ?? {}
    });
  } catch {
    // Auditing must never break the primary operation.
  }
}
