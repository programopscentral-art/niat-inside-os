// Supabase Edge Function: deadline-reminders
// Runs daily (e.g. 08:00 IST). For each open task due today/tomorrow or overdue,
// notify the assignee + watchers in-app and queue ONE digest email per user.
//
// Secrets required: SB_URL, SB_SERVICE_ROLE_KEY, EMAIL_FROM, APP_URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const url = Deno.env.get('SB_URL')!;
  const key = Deno.env.get('SB_SERVICE_ROLE_KEY')!;
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const horizon = tomorrow.toISOString().slice(0, 10);

  // Open tasks with a due date on/before tomorrow.
  const { data: tasks } = await supabase
    .from('tasks').select('id, tag, title, due_date, team_id, assignee_id, status')
    .not('status', 'in', '("DONE","CANCELLED")')
    .not('due_date', 'is', null)
    .lte('due_date', horizon);

  if (!tasks?.length) return json({ ok: true, reminded: 0 });

  // Recipients per task = assignee + watchers. Build per-user digest.
  const perUser = new Map<string, { tag: string; title: string; due: string }[]>();
  for (const t of tasks) {
    const recipients = new Set<string>();
    if (t.assignee_id) recipients.add(t.assignee_id);
    const { data: watchers } = await supabase.from('task_watchers').select('user_id').eq('task_id', t.id);
    (watchers ?? []).forEach((w: any) => recipients.add(w.user_id));
    for (const uid of recipients) {
      const arr = perUser.get(uid) ?? [];
      arr.push({ tag: t.tag, title: t.title, due: t.due_date });
      perUser.set(uid, arr);
    }
  }

  let reminded = 0;
  for (const [uid, items] of perUser) {
    for (const it of items) {
      const overdue = new Date(it.due) < new Date(now.toDateString());
      await supabase.from('notifications').insert({
        recipient_id: uid, type: 'deadline',
        title: `${overdue ? 'Overdue' : 'Due soon'}: ${it.tag}`,
        body: `${it.title} — due ${it.due}`
      });
    }
    // One digest email per user.
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', uid).maybeSingle();
    if (profile?.email) {
      const rows = items.map((i) =>
        `<li><a href="${appUrl}/tasks/${i.tag}"><b>${i.tag}</b></a> — ${i.title} <span style="color:#e0475a">(due ${i.due})</span></li>`
      ).join('');
      const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="font-weight:800;background:linear-gradient(100deg,#6d5cf0,#b45cf0);-webkit-background-clip:text;background-clip:text;color:transparent">NIAT Inside OS</div>
        <h2 style="font-size:18px">Your deadlines</h2>
        <ul style="font-size:14px;line-height:1.7">${rows}</ul></div>`;
      await supabase.from('email_outbox').insert({
        recipient_email: profile.email, subject: `You have ${items.length} task deadline(s)`, html, status: 'pending'
      });
    }
    reminded++;
  }
  return json({ ok: true, reminded });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
