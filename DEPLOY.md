# Deploy — NIAT Inside OS (GitHub → Vercel)

The database (Supabase) is already provisioned. This deploys the web app to
Vercel and points auth at the production URL.

## Step 1 — Push to GitHub
Create a **private** repo at https://github.com/new (name it `niat-inside-os`,
do NOT add a README/.gitignore — the repo already has them). Then:

```bash
git remote add origin https://github.com/<your-username>/niat-inside-os.git
git branch -M main
git push -u origin main
```

(The initial commit is already made. `.env.local` and secrets are gitignored.)

## Step 2 — Import into Vercel
1. Go to https://vercel.com → **Add New… → Project** → import `niat-inside-os`.
2. Framework preset: **Next.js** (auto-detected). Root dir: `./`. Leave build
   settings default.
3. **Before the first deploy, add Environment Variables** (Production +
   Preview). Copy the values from your local `.env.local` — do not retype
   secrets from anywhere else:

   | Key | Value (from .env.local) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://dpwubohfltgtdyyqinou.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `sb_publishable_…` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `sb_secret_…` key |
   | `RESEND_API_KEY` | the `re_…` key |
   | `EMAIL_FROM` | `NIAT Inside OS <onboarding@resend.dev>` |
   | `ALLOWED_DOMAIN` | `nxtwave.co.in` |
   | `ADMIN_EMAILS` | `nalamasa.sanjay@nxtwave.co.in` |
   | `NEXT_PUBLIC_APP_URL` | set after step 3 to your Vercel URL |

   > `SUPABASE_DB_URL` / pool URL are NOT needed at runtime (only for migrations,
   > already applied). Don’t add them to Vercel.
4. Click **Deploy**. You’ll get a URL like `https://niat-inside-os.vercel.app`.

## Step 3 — Point auth at the production URL
1. Set `NEXT_PUBLIC_APP_URL` in Vercel to your deployed URL, then **redeploy**
   (Deployments → ⋯ → Redeploy) so the value is baked in.
2. **Supabase → Authentication → URL Configuration:**
   - **Site URL** = `https://<your-vercel-url>`
   - **Redirect URLs** → add `https://<your-vercel-url>/**` (keep
     `http://localhost:3000/**` for local dev).
3. **Google Cloud → APIs & Services → Credentials → your OAuth client:**
   - **Authorized JavaScript origins** → add `https://<your-vercel-url>`
   - Authorized redirect URI stays the Supabase callback (no change).

## Step 4 — Smoke test
Open the Vercel URL → **Continue with Google** → sign in with `@nxtwave.co.in`.
First admin login (`nalamasa.sanjay@nxtwave.co.in`) lands with the **Admin** nav.
Create a team, appoint a manager, create a ticket, tag someone.

## Step 5 (optional) — Email retry + deadline cron
Deploy the Edge Functions and schedule them — see
`supabase/functions/README.md`. Until then, in-app notifications and immediate
email already work; only queued-retry and daily deadline digests wait on this.

## Auto-deploy
Every `git push` to `main` triggers a new Vercel production deploy. Use PRs +
preview deployments for changes.

## Rollback
Vercel → Deployments → pick a previous successful deploy → **Promote to
Production**.
