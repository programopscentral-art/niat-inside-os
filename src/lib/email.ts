import 'server-only';
import { Resend } from 'resend';
import { serverEnv } from './env';
import { createSupabaseAdmin } from './supabase/admin';

/**
 * Queue an email in email_outbox and attempt an immediate send. If the send
 * fails (quota, transient), the row stays 'pending' for the flush-emails cron
 * to retry — so a request is never blocked by email delivery.
 */
export async function queueEmail(to: string, subject: string, html: string) {
  const admin = createSupabaseAdmin();
  const { data: row } = await admin
    .from('email_outbox')
    .insert({ recipient_email: to, subject, html, status: 'pending' })
    .select('id')
    .single();

  const env = serverEnv();
  if (!env.RESEND_API_KEY) return; // no key configured yet — leave queued

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
    if (error) throw new Error(error.message);
    if (row) {
      await admin.from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: 1 })
        .eq('id', row.id);
    }
  } catch (e: any) {
    if (row) {
      await admin.from('email_outbox')
        .update({ status: 'pending', attempts: 1, last_error: String(e?.message || e) })
        .eq('id', row.id);
    }
  }
}

export function emailShell(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a2e">
    <div style="font-weight:800;font-size:18px;background:linear-gradient(100deg,#6d5cf0,#b45cf0);-webkit-background-clip:text;background-clip:text;color:transparent">NIAT Inside OS</div>
    <h2 style="font-size:18px;margin:18px 0 8px">${title}</h2>
    <div style="font-size:14px;line-height:1.6;color:#444">${bodyHtml}</div>
    ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:18px;background:#6d5cf0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">${ctaLabel || 'Open'}</a>` : ''}
    <p style="margin-top:24px;font-size:12px;color:#9aa">You're receiving this because you use NIAT Inside OS.</p>
  </div>`;
}
