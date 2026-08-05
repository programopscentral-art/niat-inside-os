# NIAT Inside OS

One platform for teams at NIAT to assign work, raise tickets, tag people across
teams, track progress and deadlines — with **database-level team isolation**,
role-based permissions, email notifications, and a full audit trail.

- **Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres + Auth +
  RLS) · Tailwind · TanStack Query · Resend · deploy on Vercel.
- **Auth:** Google OAuth via Supabase, restricted to `@nxtwave.co.in`.
- **Isolation:** enforced by Postgres Row-Level Security — a bug in the UI can’t
  leak another team’s data.

---

## Run locally

Prerequisites: Node 20+ and the Supabase project already created (it is —
ref `dpwubohfltgtdyyqinou`, region ap-northeast-1).

```bash
npm install
npm run db:apply     # applies supabase/migrations/* to the live database
npm run dev          # http://localhost:3000
```

Environment lives in `.env.local` (already populated, gitignored). See
`.env.local.template` for the full list.

> **Port 3000 matters.** Google OAuth + Supabase redirect URLs are pinned to
> `http://localhost:3000`. Run the app there, or add your alternate origin to
> **Supabase → Auth → URL Configuration** and the **Google OAuth client**.

### First sign-in / becoming admin
The first time anyone signs in, a `profiles` row is auto-created by a database
trigger. If their email is in `app_config.admin_emails` (seeded with
`nalamasa.sanjay@nxtwave.co.in`), they become `super_admin` automatically.
Admins create teams and appoint managers from **/admin**.

To change the admin allow-list later, update the `app_config` row (or edit
`supabase/migrations/0003_seed.sql` and re-run `npm run db:apply`).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run db:apply` | Apply all SQL migrations to the database (idempotent) |

---

## How it works

- **Roles.** Global: `super_admin`, `user`. Per-team: `manager`, `lead`,
  `member`, `viewer`. A manager can grant any member **extra capabilities**
  beyond their role’s defaults — checkbox matrix in **Manage → Members**.
- **Capabilities** (team-scoped): `VIEW_TEAM, CREATE_TASK, ASSIGN_TASK,
  EDIT_OWN_TASK, EDIT_ANY_TASK, CLOSE_TASK, DELETE_TASK, COMMENT, SEND_EMAIL,
  MANAGE_MEMBERS, APPROVE_JOIN, MANAGE_TEAM`. The DB function `has_cap()` is the
  source of truth; the UI mirrors it.
- **Tickets.** Each task gets an atomic per-team tag `TEAMKEY-<n>` (e.g.
  `ENG-1042`). Board is Kanban with drag-to-status; detail view has progress,
  remarks, due date, assignee, watchers, comments.
- **Cross-team tagging.** `@mention` someone (or “Tag” them on a task) and they
  become a **watcher** with access to *only that ticket* — never the rest of the
  team’s work. This is the sanctioned way other teams ask questions / give input.
- **Notifications.** In-app + optional email (Resend). Emails are queued in
  `email_outbox` and never block a request.
- **Audit.** Every mutation writes an `audit_log` row.

### Data model
`profiles, teams, team_members, role_capabilities, join_requests,
team_counters, tasks, task_watchers, comments, mentions, notifications,
email_outbox, audit_log, app_config`. See `supabase/migrations/`.

---

## Deploy to Vercel

1. Push this repo to GitHub (secrets stay in `.env.local`, which is gitignored).
2. Import into Vercel; set the env vars from `.env.local` in Vercel’s
   Environment Variables (set `NEXT_PUBLIC_APP_URL` to your Vercel URL).
3. In **Supabase → Auth → URL Configuration**, set Site URL + add the Vercel URL
   to Redirect URLs. In the **Google OAuth client**, add the Vercel origin.
4. Deploy. `npm run db:apply` has already provisioned the database.

---

## Security highlights
- RLS enabled on every table; deny-by-default; `has_cap()` / `is_member()` /
  `can_view_task()` security-definer helpers.
- Service-role key is server-only (`src/lib/supabase/admin.ts`, `server-only`
  import guard); never shipped to the browser.
- Domain lock in depth: OAuth `hd` hint + `handle_new_user` DB trigger +
  middleware.
- Zod validation on every server action; markdown sanitized on render.
- Privilege-escalation guard trigger on `profiles`; admin role changes only via
  `SECURITY DEFINER` RPCs that re-check `is_super_admin()`.

See `DECISIONS.md` for choices made during the build and the follow-on backlog.
