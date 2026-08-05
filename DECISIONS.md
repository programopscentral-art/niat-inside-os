# Build decisions & backlog

Decisions made during the build (deviations from `BUILD_PROMPT.md` are called
out), and the remaining follow-on work.

## Decisions / deviations
- **Single Next.js app at the repo root** instead of a `apps/web` monorepo —
  simpler to run and deploy for v1; can be split later without code changes.
- **npm** instead of pnpm — corepack could not activate pnpm in this
  environment (needs admin to write to `Program Files`). Lockfile is npm’s.
- **Hand-built UI primitives** (button, dialog, toast, badges, avatar) with
  Tailwind instead of the shadcn CLI — avoids an interactive init step and keeps
  the design system self-contained in `globals.css`.
- **Supabase key format:** the project uses the new `sb_publishable_*` /
  `sb_secret_*` keys. Publishable → anon (browser); secret → service role
  (server). Legacy JWTs are also stored in `.env.local` for tooling that needs
  them.
- **Migrations applied via the session-mode pooler** (`aws-0-ap-northeast-1`)
  because the direct DB host is IPv6-only from this network. See
  `scripts/db-apply.mjs`.
- **Email uses the Resend test sender** (`onboarding@resend.dev`) until the
  `nxtwave.co.in` sending domain is verified in Resend (needs DNS). Only
  `EMAIL_FROM` changes at that point.
- **Bootstrap admin** = `nalamasa.sanjay@nxtwave.co.in` (must be on the allowed
  domain to log in). Change via `app_config.admin_emails`.
- **“Users must sign in once” constraint:** you can only assign/add/tag a person
  who already has a `profiles` row (created on their first login), because of the
  FK to `auth.users`. Surfaced as a friendly error in the UI.

## What’s live and verified
- Full Postgres schema + enums + isolation functions + RLS + seed, applied to
  the live database (4 migrations).
- Auth (Google + domain lock), middleware, app shell, and all core screens:
  dashboard, teams browse/join, Kanban board, task detail (status/priority/
  progress/remarks/due/assignee/watchers/comments/@mention), team management
  (members + permission matrix + join-request approval), admin console
  (teams/managers/users/stats), notifications.
- `tsc --noEmit` passes with strict mode; app compiles and renders in dev.

## Backlog (recommended next, in order)
1. **Full end-to-end login test on port 3000** (blocked only by the port being
   in use by another local app).
2. **Scheduled Edge Functions:** `flush-emails` (retry queued mail under the
   daily cap) and `deadline-reminders` (daily digest of due-soon/overdue tasks).
   Code + `pg_cron` scheduling. In-app + immediate email already work.
3. **Realtime** subscriptions for the board and the notification bell.
4. **Tests:** Vitest (capabilities, tag gen, zod), SQL/RLS isolation proofs,
   Playwright e2e for the golden path + the Team-A-can’t-see-Team-B negative.
5. **CI:** GitHub Actions (typecheck + lint + tests + build).
6. **Rate limiting** on mutations, `SECURITY.md`, `PERF.md` (indexes + EXPLAIN +
   a load-test script).
