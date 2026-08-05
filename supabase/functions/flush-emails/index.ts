// Supabase Edge Function: flush-emails
// Sends queued emails from email_outbox via Resend, with retry/backoff and a
// daily cap. Schedule every ~2 minutes (see supabase/functions/README.md).
//
// Secrets required (supabase secrets set):
//   SB_URL, SB_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM, EMAIL_DAILY_CAP
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const url = Deno.env.get('SB_URL')!;
  const key = Deno.env.get('SB_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('EMAIL_FROM') ?? 'NIAT Inside OS <onboarding@resend.dev>';
  const dailyCap = Number(Deno.env.get('EMAIL_DAILY_CAP') ?? '1400');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const today = new Date().toISOString().slice(0, 10);
  const { count: sentToday } = await supabase
    .from('email_outbox').select('id', { count: 'exact', head: true })
    .eq('status', 'sent').gte('sent_at', today + 'T00:00:00Z');

  let budget = Math.max(0, dailyCap - (sentToday ?? 0));
  if (budget === 0) return json({ ok: true, skipped: 'daily cap reached' });

  const { data: pending } = await supabase
    .from('email_outbox').select('*')
    .eq('status', 'pending').lt('attempts', 5)
    .order('created_at', { ascending: true }).limit(Math.min(budget, 50));

  let sent = 0, failed = 0;
  for (const row of pending ?? []) {
    if (budget <= 0) break;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: row.recipient_email, subject: row.subject, html: row.html })
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      await supabase.from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: (row.attempts ?? 0) + 1 })
        .eq('id', row.id);
      sent++; budget--;
    } catch (e) {
      const attempts = (row.attempts ?? 0) + 1;
      await supabase.from('email_outbox')
        .update({ status: attempts >= 5 ? 'failed' : 'pending', attempts, last_error: String(e) })
        .eq('id', row.id);
      failed++;
    }
  }
  return json({ ok: true, sent, failed, remainingBudget: budget });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
