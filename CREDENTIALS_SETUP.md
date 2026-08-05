# Credentials Setup — NIAT Inside OS

Get these three sets of secrets, paste them into `.env.local` (local) and Vercel
+ Supabase (production). Order matters: do **Supabase first** (you need its
project URL for the Google redirect), then **Google**, then **Resend**.

---

## 1. Supabase (database + auth)  — ~5 min

1. Go to https://supabase.com → sign in with GitHub/Google → **New project**.
2. Org = your team; **Name** = `niat-inside-os`; set a strong **DB password**
   (save it); **Region** = `Mumbai (ap-south-1)` (closest to India = lowest
   latency); plan = Free to start.
3. Wait ~2 min for provisioning.
4. **Settings → API** — copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`  ⚠️ **secret — server
     only, never in the browser / never commit.**
5. **Settings → Database → Connection string**:
   - **URI (direct)** → `SUPABASE_DB_URL` (used to run migrations).
   - **Connection pooling → Transaction mode** URI → use this for serverless
     runtime (mentioned in the build prompt §12).
6. Project ref = the `xxxx` in `https://xxxx.supabase.co` — you need it for the
   Google redirect URL below.

---

## 2. Google OAuth (login with @nxtwave.co.in)  — ~10 min

> This uses `nxtwave.co.in` Google Workspace. If you are **not** a Workspace admin,
> you can still create the OAuth client in a Google Cloud project you own, but
> setting the consent screen to **Internal** requires the project to live under
> the nxtwave.co.in organization — you may need your IT/Workspace admin for that
> one toggle. Internal = only nxtwave.co.in accounts can log in, which is exactly
> what we want (it reinforces the domain lock).

1. Go to https://console.cloud.google.com → create a project `niat-inside-os`
   (pick the **nxtwave.co.in** organization if it's offered in the org dropdown).
2. **APIs & Services → OAuth consent screen**:
   - User type = **Internal** (if available under nxtwave.co.in) → Create.
   - App name = `NIAT Inside OS`, support email = your nxtwave email, developer
     contact = your email. Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type = **Web application**, name = `niat-inside-os-web`.
   - **Authorized JavaScript origins** (add all you'll use):
     - `http://localhost:3000`
     - `https://<your-vercel-domain>` (add after you deploy; you can edit later)
   - **Authorized redirect URIs** — this must point at Supabase, not your app:
     - `https://<project-ref>.supabase.co/auth/v1/callback`
   - Create → copy the **Client ID** and **Client secret**.
4. Put them into **Supabase**, not your `.env`:
   **Supabase → Authentication → Providers → Google** → enable → paste Client ID
   + Client secret → Save.
5. **Supabase → Authentication → URL Configuration**:
   - **Site URL** = `http://localhost:3000` (dev) / your Vercel URL (prod).
   - **Redirect URLs** = add `http://localhost:3000/**` and
     `https://<your-vercel-domain>/**`.
6. Env values: `ALLOWED_DOMAIN=nxtwave.co.in`,
   `ADMIN_EMAILS=programopscentral@nxtwave.co.in`. (The Client ID/secret live in
   Supabase; your app never needs them directly.)

---

## 3. Resend (transactional email)  — ~10 min + DNS wait

> Sending as `@nxtwave.co.in` requires adding DNS records to the nxtwave.co.in domain
> — that usually needs whoever manages NIAT's DNS (IT/admin). If you can't get
> that yet, use Resend's test sender to unblock development and switch the
> domain later.

1. Go to https://resend.com → sign up.
2. **API Keys → Create API Key** (name `niat-inside-os`, permission = Sending) →
   copy → `RESEND_API_KEY`. ⚠️ Shown once.
3. **Domains → Add Domain**:
   - **For production:** add `nxtwave.co.in` (or a subdomain like
     `mail.nxtwave.co.in`). Resend shows DNS records (SPF `TXT`, DKIM `TXT`,
     optional `MX`/DMARC). Give these to whoever manages nxtwave.co.in DNS; once
     added, click **Verify**. Then `EMAIL_FROM="NIAT Inside OS
     <no-reply@nxtwave.co.in>"`.
   - **For dev / if no DNS access yet:** skip domain verification and set
     `EMAIL_FROM="NIAT Inside OS <onboarding@resend.dev>"` — Resend's shared
     test sender. Works immediately but only sends to your own verified address
     and isn't for production. Swap to the real domain before launch.

---

## Where each value goes

`.env.local` (local dev — never commit; `.gitignore` it):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres
RESEND_API_KEY=re_...
EMAIL_FROM=NIAT Inside OS <onboarding@resend.dev>
ALLOWED_DOMAIN=nxtwave.co.in
ADMIN_EMAILS=nalamasa.sanjay@nxtwave.co.in
NEXT_PUBLIC_APP_URL=http://localhost:3000
SENTRY_DSN=            # optional, add later
```

- **Vercel:** Project → Settings → Environment Variables → add the same keys
  (set `NEXT_PUBLIC_APP_URL` + Supabase Site URL to your Vercel domain).
- **Supabase Edge Functions** (for email cron): store `RESEND_API_KEY`,
  `EMAIL_FROM`, `SUPABASE_SERVICE_ROLE_KEY` as function secrets via
  `supabase secrets set ...` (the build README will script this).

---

## Minimum to start the build

You can hand the project to Claude Code as soon as you have **#1 (Supabase)** +
**#2 (Google)**. Email (#3) can begin with the `resend.dev` test sender and be
pointed at the real domain later — the code path is identical, only `EMAIL_FROM`
and domain verification change.

## Things that may need someone else at NIAT
- Setting the Google consent screen to **Internal** under the nxtwave.co.in org.
- Adding **DNS records** for the Resend sending domain.
Flag these to your IT/Workspace admin early — they're the only external
dependencies.
