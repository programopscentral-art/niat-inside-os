# Edge Functions — deploy & schedule

Two scheduled functions:
- **flush-emails** — drains `email_outbox` via Resend (retry/backoff + daily cap). Every ~2 min.
- **deadline-reminders** — daily digest of due-soon/overdue open tasks. Once a day.

> The app already sends notifications in-app and attempts email immediately on
> assign/tag/mention. These functions add reliable **retry** and **deadline**
> coverage. Until they’re deployed, email that fails on first try simply stays
> `pending` in `email_outbox`.

## 1. Install the Supabase CLI & log in
```bash
npm i -g supabase        # or: npx supabase ...
supabase login
supabase link --project-ref dpwubohfltgtdyyqinou
```

## 2. Set secrets (function runtime env)
`SUPABASE_URL`/`SUPABASE_*` names are reserved, so we use `SB_`-prefixed names.
```bash
supabase secrets set \
  SB_URL="https://dpwubohfltgtdyyqinou.supabase.co" \
  SB_SERVICE_ROLE_KEY="<service secret key>" \
  RESEND_API_KEY="<resend key>" \
  EMAIL_FROM="NIAT Inside OS <onboarding@resend.dev>" \
  EMAIL_DAILY_CAP="1400" \
  APP_URL="https://<your-vercel-domain>"
```

## 3. Deploy
```bash
supabase functions deploy flush-emails
supabase functions deploy deadline-reminders
```

## 4. Schedule with pg_cron + pg_net
Run this SQL in the Supabase SQL editor (enables extensions, then schedules the
HTTP calls). Replace `<ANON_OR_SERVICE_JWT>` with a key that can invoke functions.
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('flush-emails', '*/2 * * * *', $$
  select net.http_post(
    url := 'https://dpwubohfltgtdyyqinou.functions.supabase.co/flush-emails',
    headers := '{"Authorization":"Bearer <ANON_OR_SERVICE_JWT>","Content-Type":"application/json"}'::jsonb
  );
$$);

-- 08:00 IST == 02:30 UTC
select cron.schedule('deadline-reminders', '30 2 * * *', $$
  select net.http_post(
    url := 'https://dpwubohfltgtdyyqinou.functions.supabase.co/deadline-reminders',
    headers := '{"Authorization":"Bearer <ANON_OR_SERVICE_JWT>","Content-Type":"application/json"}'::jsonb
  );
$$);
```
Unschedule with `select cron.unschedule('flush-emails');`.
