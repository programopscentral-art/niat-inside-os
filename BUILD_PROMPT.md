# BUILD PROMPT — "NIAT Inside OS" (Team Work & Ticketing Platform)

> Hand this entire document to Claude Code as the task. It is the complete,
> authoritative specification. Build the whole product to the acceptance
> criteria at the end. Do not ask clarifying questions unless a hard blocker
> (missing secret/credential) is hit; make reasonable, documented decisions
> for everything else and keep moving.

---

## 0. Your role & operating rules

You are a senior full-stack engineer. Deliver a **production-ready** web
application, not a prototype. Follow these rules for the whole build:

1. **Do not stop after scaffolding.** Implement every feature listed here end
   to end (DB → API → UI → tests → docs).
2. **Security is a hard requirement, not a phase.** Every table has RLS.
   Every mutation is authorized on the server. No client ever holds a
   service-role key.
3. Work in small, verifiable increments. After each module, run typecheck +
   lint + tests and fix before moving on.
4. Write **idempotent SQL migrations** (numbered) and a **seed script**. The
   database must be reproducible from zero with one command.
5. Prefer clarity over cleverness. Strong typing everywhere (TypeScript strict,
   Zod at every boundary). No `any`.
6. When something is ambiguous, pick the option documented here; if not
   documented, pick the simplest secure default and note it in `DECISIONS.md`.
7. Produce a `README.md` that lets a new dev go from clone → running locally →
   deployed, with zero tribal knowledge.

---

## 1. Problem statement (why this exists)

NIAT (part of NxtWave, India) has many teams and 1000+ employees. Today nobody
has visibility into **who is working on what**, whether work is **done**, how
much is **complete**, what the **remarks/blockers** are, or how to **escalate**.
There is no single place to assign work, raise a ticket, tag a person/team, set
deadlines, and communicate — end to end.

This product is that single platform: **team-scoped task & ticket management
with role-based permissions, cross-team tagging, email notifications, deadlines,
and a full audit trail.**

Core rules that must hold:
- One team's work **must never be visible** to another team by default
  (enforced in the database, not just the UI).
- A **Super Admin** creates teams and appoints a **Manager** per team.
- The **Manager** runs their team: approves join requests, adds/removes members,
  and **grants each member fine-grained permissions**.
- Members with permission can create tasks/tickets, **assign & tag** people,
  set deadlines, track progress/remarks, and optionally **email** on assignment.
- People from **other teams can be tagged** into a task to ask questions / give
  input (cross-team collaboration) **without** gaining access to the rest of
  that team's work.
- Everyone logs in with their **@nxtwave.co.in** Google account.

---

## 2. Tech stack (pinned — do not substitute)

- **Frontend + server:** Next.js 14 (App Router) + TypeScript (strict). Deploy
  on **Vercel**.
- **UI:** Tailwind CSS + shadcn/ui + lucide-react icons. Accessible (WCAG AA).
- **Data/DB/Auth:** **Supabase** (Postgres 15 + Auth + Row-Level Security +
  Realtime + Edge Functions + Storage). This is the whole backend — **no
  separate Render service** for v1.
- **Server logic:** Next.js Route Handlers / Server Actions for user-facing
  mutations; **Supabase Edge Functions (Deno)** for scheduled jobs (email flush,
  deadline reminders).
- **Data fetching/cache:** TanStack Query (React Query).
- **Validation:** Zod (shared schemas between client and server).
- **Email:** **Resend** (transactional). Queue + batch send with a daily cap.
- **Errors/observability:** Sentry (frontend + edge functions), structured logs.
- **Auth provider:** Google OAuth via Supabase, **restricted to nxtwave.co.in**.
- **Testing:** Vitest (unit) + Playwright (e2e) + pgTAP or SQL tests for RLS.
- **CI:** GitHub Actions (typecheck, lint, test, build on every PR).
- **Package manager:** pnpm. Node 20.

Rationale reminder: Postgres + connection pooling handles 1000+ concurrent
easily; RLS enforces team isolation at the database layer; Resend removes the
Sheets 1,500/day email ceiling. Do **not** use Google Sheets.

---

## 3. Users, roles & the permission model

### Global roles (on `profiles.global_role`)
- `super_admin` — org owner. Creates teams, appoints/replaces managers,
  manages users, sees everything, reads global audit. Bootstrapped from an env
  allow-list (`nalamasa.sanjay@nxtwave.co.in`).
- `user` — default for everyone who logs in.

### Team roles (on `team_members.team_role`, scoped to one team)
- `manager` — full control of that team (all capabilities).
- `lead` — create/assign/edit/close tasks, comment, email.
- `member` — create/edit own tasks, comment, email.
- `viewer` — view + comment only.

### Capabilities (fine-grained, team-scoped)
`VIEW_TEAM, CREATE_TASK, ASSIGN_TASK, EDIT_OWN_TASK, EDIT_ANY_TASK, CLOSE_TASK,
DELETE_TASK, COMMENT, SEND_EMAIL, MANAGE_MEMBERS, APPROVE_JOIN, MANAGE_TEAM`.

**Effective capabilities of a member = default caps for their team_role UNION
the extra caps the manager granted on that membership row.** A manager can grant
any subset to any member (e.g. give a `member` the `ASSIGN_TASK` cap). Enforce
this in a Postgres `has_cap(team_id, cap)` function used by RLS **and** re-check
in server actions.

Default role→caps map (seed into a `role_capabilities` table):
- manager: ALL
- lead: VIEW_TEAM, CREATE_TASK, ASSIGN_TASK, EDIT_OWN_TASK, EDIT_ANY_TASK, CLOSE_TASK, COMMENT, SEND_EMAIL
- member: VIEW_TEAM, CREATE_TASK, EDIT_OWN_TASK, COMMENT, SEND_EMAIL
- viewer: VIEW_TEAM, COMMENT

---

## 4. Feature requirements (user stories — all must ship)

### Auth & onboarding
- Sign in with Google, **restricted to `@nxtwave.co.in`** (see §7). First login
  auto-creates a `profiles` row (`global_role='user'`, or `super_admin` if the
  email is in the admin allow-list).
- Landing/dashboard shows: my teams, my open tasks (assigned to me), tasks I
  created, unread notifications, and pending items needing my action.

### Super Admin
- Create/rename/archive teams; set a unique `team_key` (e.g. `ENG`).
- Appoint/replace a team's manager.
- Promote/demote global roles; suspend/reactivate users.
- View org-wide audit log and a cross-team analytics summary (task counts by
  status/team, overdue counts). Super admin can see all teams' data.

### Team join flow
- Any user can browse the list of teams (name/key/description/manager only) and
  **request to join** with a message.
- The team's manager (or anyone with `APPROVE_JOIN`) sees pending requests and
  **approves (choosing role + optional extra caps) or rejects** them.
- On approval the requester becomes an active member with the granted
  permissions and is notified (in-app + optional email).

### Manager / team administration
- Manage members: add by email (invite), remove, change role, and **edit each
  member's capability set** with checkboxes.
- Edit team settings (name/description), archive team.
- See the full team board and everyone's workload.

### Tasks / tickets (the core)
- Create a task/ticket in a team with: title, description (markdown), priority
  (`LOW|MEDIUM|HIGH|URGENT`), assignee, watchers, labels, due date.
- Each task gets a human **tag** = `TEAMKEY-<n>` (e.g. `ENG-1042`), generated
  atomically per team (see §6). Tag is unique, immutable, searchable.
- Status workflow: `OPEN → IN_PROGRESS → BLOCKED → IN_REVIEW → DONE | CANCELLED`.
- Track **progress %** (0–100) and **remarks** (free text, e.g. "waiting on
  design", "how much came").
- **Assign & tag**: assign to a member (needs `ASSIGN_TASK`), tag additional
  watchers (including **people from other teams** — they become watchers with
  view+comment access to *only that task*).
- Optional **email on assignment / tag** — a "notify by email" toggle; only
  sends if the actor has `SEND_EMAIL`.
- Board view (Kanban by status) + list/table view with filters (status,
  assignee, priority, label, overdue, search by tag/title) + pagination.
- Task detail: full history, comments thread, watchers, activity, quick actions
  (change status, reassign, set progress, edit remarks, set due date).
- Overdue tasks are visibly flagged.

### Comments, questions & cross-team tagging
- Threaded comments on a task (markdown, sanitized).
- **@mention** any user in the org by email. Mentioning a user who is not a team
  member adds them as a **watcher** of that task (grants task-scoped access
  only) and notifies them (in-app + optional email). This is how "another team
  can ask questions / give working details" without breaching isolation.

### Notifications & email
- In-app notification center (bell + unread count + realtime updates) for:
  assigned to you, mentioned/tagged, comment on a task you watch, join request
  decided, deadline approaching, status changed on your task.
- Email (Resend) is **queued** in an `email_outbox`, sent by a scheduled Edge
  Function in batches with a **daily cap** and retry/backoff. Never block a
  request on email delivery.

### Deadlines
- Scheduled Edge Function (cron) runs daily 08:00 IST: for each open task due
  today/tomorrow or overdue, notify the assignee (+watchers) in-app and enqueue
  an email digest per user (batch, one email per user, not per task).

### Realtime
- Task board and notification bell update in realtime for the current user's
  teams via Supabase Realtime (respecting RLS).

### Audit
- Every mutation writes an `audit_log` row (actor, action, entity, team,
  before/after or details JSON). Managers see their team's audit; super admin
  sees all.

---

## 5. Data model (Postgres) — implement exactly

Use `uuid` PKs (default `gen_random_uuid()`), `timestamptz` for time, and
Postgres **enums**. Create these enums: `global_role (super_admin,user)`,
`team_role (manager,lead,member,viewer)`, `task_status
(OPEN,IN_PROGRESS,BLOCKED,IN_REVIEW,DONE,CANCELLED)`, `task_priority
(LOW,MEDIUM,HIGH,URGENT)`, `join_status (pending,approved,rejected)`,
`member_status (active,invited,removed)`, `email_status
(pending,sent,failed)`.

**Tables:**

- `profiles` — `id uuid PK references auth.users(id) on delete cascade`,
  `email text unique not null`, `full_name text`, `avatar_url text`,
  `global_role global_role not null default 'user'`,
  `status text not null default 'active'` (active|suspended),
  `created_at timestamptz default now()`, `last_login_at timestamptz`.

- `teams` — `id uuid PK`, `team_key text unique not null` (2–8 uppercase
  alnum), `name text not null`, `description text`, `status text default
  'active'` (active|archived), `created_by uuid references profiles(id)`,
  `created_at timestamptz default now()`.

- `team_members` — `id uuid PK`, `team_id uuid references teams on delete
  cascade`, `user_id uuid references profiles on delete cascade`, `team_role
  team_role not null`, `permissions text[] not null default '{}'` (extra caps),
  `status member_status not null default 'active'`, `invited_by uuid`,
  `joined_at timestamptz default now()`, `unique(team_id,user_id)`.

- `role_capabilities` — `team_role team_role PK`, `caps text[] not null`.
  (seed with the defaults in §3).

- `join_requests` — `id uuid PK`, `team_id`, `user_id`, `message text`,
  `status join_status default 'pending'`, `decided_by uuid`, `decided_at`,
  `created_at default now()`, `unique(team_id,user_id) where status='pending'`
  (partial unique index to prevent duplicate pending requests).

- `team_counters` — `team_id uuid PK references teams on delete cascade`,
  `last_seq int not null default 0`. (drives per-team tag numbering, §6)

- `tasks` — `id uuid PK`, `team_id uuid references teams on delete cascade`,
  `seq int not null`, `tag text not null unique`, `title text not null`,
  `description text`, `status task_status default 'OPEN'`, `priority
  task_priority default 'MEDIUM'`, `progress int not null default 0 check
  (progress between 0 and 100)`, `assignee_id uuid references profiles`,
  `labels text[] default '{}'`, `due_date date`, `remarks text`, `created_by
  uuid references profiles`, `created_at default now()`, `updated_at default
  now()`, `unique(team_id,seq)`. Index `(team_id,status)`, `(assignee_id)`,
  `(due_date)`, and a GIN index for full-text search on title+tag+description.

- `task_watchers` — `task_id uuid references tasks on delete cascade`,
  `user_id uuid references profiles on delete cascade`, `added_by uuid`,
  `created_at default now()`, `primary key (task_id,user_id)`. **This table is
  the mechanism for cross-team access to a single task.**

- `comments` — `id uuid PK`, `task_id uuid references tasks on delete cascade`,
  `team_id uuid` (denormalized for RLS), `author_id uuid references profiles`,
  `body text not null`, `created_at default now()`. Index `(task_id,created_at)`.

- `mentions` — `id uuid PK`, `comment_id uuid references comments on delete
  cascade`, `mentioned_user_id uuid references profiles`, `created_at`.

- `notifications` — `id uuid PK`, `recipient_id uuid references profiles on
  delete cascade`, `type text not null`, `title text not null`, `body text`,
  `task_id uuid`, `team_id uuid`, `is_read boolean default false`, `created_at
  default now()`. Index `(recipient_id,is_read,created_at)`.

- `email_outbox` — `id uuid PK`, `recipient_email text not null`, `subject
  text`, `html text`, `status email_status default 'pending'`, `attempts int
  default 0`, `last_error text`, `created_at default now()`, `sent_at`. Index
  `(status,created_at)`.

- `audit_log` — `id uuid PK`, `ts timestamptz default now()`, `actor_id uuid`,
  `action text not null`, `entity_type text`, `entity_id text`, `team_id uuid`,
  `details jsonb`. Index `(team_id,ts)`.

Add an `updated_at` trigger on `tasks`.

---

## 6. Atomic per-team ticket numbering

Implement a `SECURITY DEFINER` Postgres function `next_task_tag(p_team uuid)`
that, inside a single transaction, `UPDATE team_counters SET last_seq =
last_seq + 1 WHERE team_id = p_team RETURNING last_seq` (insert the counter row
if missing), then returns `<team_key>-<last_seq>`. Call it from the create-task
server action (or a `BEFORE INSERT` trigger on `tasks` that populates `seq` and
`tag`). This guarantees gapless, collision-free tags under concurrency without
app-level locks. Seed `team_counters` when a team is created.

---

## 7. Authentication & domain lock (must be airtight)

Enforce the `@nxtwave.co.in` restriction in **four** layers (defense in depth):

1. **Google OAuth hint:** pass `queryParams: { hd: 'nxtwave.co.in', prompt:
   'select_account' }` on `signInWithOAuth`.
2. **Supabase Auth Hook (server-side, authoritative):** a `before-user-created`
   / custom access-token hook (Postgres function) that **rejects** any email
   not ending in `@nxtwave.co.in` and stamps the domain-verified claim. Non-domain
   sign-ups must fail even if they bypass the UI.
3. **DB trigger** on `profiles` insert: raise an exception if `email` domain ≠
   allowed domain. Set `global_role='super_admin'` when email ∈ admin allow-list
   (read from a `app_config` row or env-seeded table), else `'user'`.
4. **Next.js middleware:** verify a valid Supabase session on every non-public
   route; re-check the email domain from the JWT; redirect to sign-in otherwise.

Sessions via Supabase SSR helpers (`@supabase/ssr`), httpOnly cookies. The
service-role key is used **only** in server-side code (Edge Functions / route
handlers) and **never** shipped to the client.

---

## 8. Row-Level Security (enable RLS on every table; write these policies)

Create `SECURITY DEFINER` helper functions (search_path locked):
- `is_super_admin()` → current user's `global_role = 'super_admin'`.
- `is_member(p_team uuid)` → active row in `team_members` for `auth.uid()`.
- `is_watcher(p_task uuid)` → row in `task_watchers` for `auth.uid()`.
- `has_cap(p_team uuid, p_cap text)` → super_admin OR the cap ∈ (role defaults
  from `role_capabilities` ∪ `team_members.permissions`) for the active
  membership.

Policies (principle of least privilege; deny by default):
- **profiles:** `select` allowed to any authenticated user (needed for
  assignee/mention pickers) but expose only safe columns via a view
  `profiles_public`; `update` only own row and only safe fields; `global_role`
  and `status` changes only via super_admin server action (service role).
- **teams:** `select` to any authenticated user (browse-to-join shows only
  key/name/description/manager — restrict columns via a view for non-members);
  `insert/update/delete` only `is_super_admin()` (or manager for update when
  policy allows MANAGE_TEAM).
- **team_members:** `select` if `is_super_admin()` OR `is_member(team_id)` OR
  `user_id = auth.uid()`; `insert/update/delete` only if `is_super_admin()` OR
  `has_cap(team_id,'MANAGE_MEMBERS')`.
- **join_requests:** `select` own rows OR `has_cap(team_id,'APPROVE_JOIN')` OR
  super_admin; `insert` own row for a team you're not already in; `update`
  (decide) only `has_cap(team_id,'APPROVE_JOIN')`.
- **tasks:** `select` if `is_super_admin()` OR `is_member(team_id)` OR
  `is_watcher(id)`; `insert` if `has_cap(team_id,'CREATE_TASK')`; `update` if
  `has_cap(team_id,'EDIT_ANY_TASK')` OR (`has_cap(...,'EDIT_OWN_TASK')` AND
  `auth.uid() in (created_by, assignee_id)`); `delete` if
  `has_cap(team_id,'DELETE_TASK')`. Status→DONE/CANCELLED additionally requires
  `CLOSE_TASK` (enforce in server action).
- **task_watchers:** `select` if can view the task; `insert/delete` if can view
  the task AND has `ASSIGN_TASK` (or is the task creator). Mentioning inserts a
  watcher via server action (service role) after authorizing.
- **comments:** `select` if can view the parent task; `insert` if can view the
  task AND `has_cap(team_id,'COMMENT')` (watchers from other teams get COMMENT
  implicitly — allow comment if `is_watcher`).
- **mentions:** `select` if can view the parent comment's task; insert via
  server action.
- **notifications:** `select/update` only where `recipient_id = auth.uid()`;
  insert via server (service role).
- **email_outbox / audit_log:** no client access. Insert/select via service
  role only (audit readable to managers/super_admin through a dedicated view +
  policy).

**Write a SQL test suite (pgTAP or scripted) proving:** a member of Team A
cannot select Team B's tasks/comments; a watcher can read only their one task;
a `viewer` cannot insert tasks; a non-manager cannot approve join requests;
`has_cap` respects granted extra permissions.

---

## 9. Server API design

Expose mutations as **typed server actions / route handlers** (`app/api/...` or
`"use server"`). Every one must:
1. Resolve the session user server-side (never trust client identity).
2. Validate input with a shared **Zod** schema.
3. Authorize with `has_cap` / role checks (belt-and-suspenders with RLS).
4. Perform the write (RLS-scoped client for the user; service-role only for
   privileged ops like inserting notifications, watchers on mention, audit).
5. Write an `audit_log` entry.
6. Enqueue notifications/emails as needed.
7. Return a typed result; map errors to safe messages.

Required endpoints (group logically): `me/bootstrap`, teams
(`create/rename/archive/assignManager/list/get`), membership
(`list/add/remove/updateRole/updatePermissions`), join requests
(`create/list/decide`), tasks (`create/get/list(filters,pagination)/update/
assign/setStatus/setProgress/setRemarks/setDue/addWatcher/removeWatcher/
delete`), comments (`add/list`) with mention parsing, notifications
(`list/markRead/markAllRead`), admin (`listUsers/setGlobalRole/suspendUser/
analytics`).

**Rate limiting:** per-user sliding window (e.g. Upstash Redis or a Postgres
token-bucket) on mutating endpoints. **Pagination:** keyset/cursor pagination on
all list endpoints (never fetch unbounded). **N+1:** batch queries; select only
needed columns.

---

## 10. Frontend (Next.js App Router)

Routes: `/(auth)/sign-in`, `/dashboard`, `/teams` (browse + request join),
`/teams/[key]` (board), `/teams/[key]/list`, `/teams/[key]/members` (manager),
`/teams/[key]/requests` (manager), `/tasks/[tag]` (detail), `/notifications`,
`/admin` (super admin: teams, users, audit, analytics), `/settings`.

Requirements:
- Responsive, accessible, keyboard-navigable; dark + light themes.
- Kanban board with drag-to-change-status (optimistic + rollback on error).
- Reusable components: TaskCard, TaskDetailDrawer, StatusBadge, PriorityBadge,
  AssigneePicker (searchable), MentionInput (@ + email), PermissionMatrix
  (checkbox grid), Filters bar, EmptyStates, Skeleton loaders, Toasts.
- All server data via TanStack Query with realtime cache invalidation.
- **Sanitize all markdown/user HTML** (rehype-sanitize). Escape everything.
- Loading, empty, error, and permission-denied states for every view.
- Show the ticket `tag` prominently everywhere; make it copyable/linkable.

---

## 11. Security requirements (checklist — all mandatory)

- RLS enabled and tested on every table; deny-by-default.
- Service-role key only server-side; validated at build that it never reaches
  the client bundle.
- Zod validation on 100% of inputs; reject unknown fields.
- Output encoding / markdown sanitization (no stored XSS).
- CSRF-safe mutations (SameSite cookies + server actions); no state-changing GET.
- Security headers via middleware: strict CSP, HSTS, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, frame-ancestors 'none'.
- Rate limiting + basic abuse protection on auth and mutations.
- Secrets only in env / Vercel & Supabase secret stores; `.env.example`
  documents every key; nothing secret committed.
- Full audit log of privileged actions; managers/super-admin readable.
- Least-privilege OAuth scopes; domain lock (§7) verified server-side.
- Dependency audit (`pnpm audit`) clean of high/critical; Dependabot config.
- PII minimization; no personal data in URLs/query strings or logs.

---

## 12. Performance & scale (target: 1000+ concurrent daily users)

- Use Supabase **connection pooler (transaction mode)** for serverless routes;
  never open a raw connection per request.
- Every hot query backed by an index (see §5); verify with `EXPLAIN` in a perf
  note. Keyset pagination everywhere.
- Cache read-heavy, low-churn data (teams list, role caps) with TanStack Query
  staleTime + HTTP caching where safe.
- Realtime subscriptions scoped to the user's teams only.
- Emails and reminders are async (queue + cron), never inline.
- Include a lightweight load-test script (k6 or autocannon) hitting the board
  and task-create paths, and document the results/limits in `PERF.md`.

---

## 13. Scheduled jobs (Supabase Edge Functions + cron)

- `flush-emails` — every 2 minutes: pull `email_outbox` where `status='pending'`
  (bounded batch), send via Resend, mark sent/failed with attempts + backoff,
  enforce a daily cap counter; log results.
- `deadline-reminders` — daily 08:00 IST: build per-user digests of due-soon /
  overdue open tasks, create notifications, enqueue one digest email per user.
- Schedule via `pg_cron` or Supabase scheduled functions; document how.

---

## 14. Testing (Definition of Done includes green tests)

- **Unit (Vitest):** capability logic, tag generation, Zod schemas, notification
  builders, email templating.
- **RLS/SQL tests:** the isolation proofs in §8.
- **E2E (Playwright):** sign-in (mocked Google), create team (admin), request +
  approve join, create task → assign + email toggle → comment with @mention
  (cross-team watcher gains task access) → change status/progress → notification
  appears → task closes. Negative tests: viewer blocked from creating, Team A
  user cannot open Team B task URL (403).
- CI must run typecheck, lint, unit, and RLS tests on every PR and block merge
  on failure.

---

## 15. Project structure & deliverables

```
/apps/web                 # Next.js app
/supabase
  /migrations             # numbered idempotent SQL (schema, enums, RLS, functions, seed)
  /functions              # edge functions: flush-emails, deadline-reminders
  seed.sql
/packages/shared          # zod schemas, types, capability constants shared client+server
/tests                    # e2e + rls tests
/.github/workflows        # ci.yml
README.md                 # setup, local dev, deploy, architecture diagram
DECISIONS.md              # every assumption you made
PERF.md                   # indexes, EXPLAIN notes, load-test results
SECURITY.md               # threat model + the §11 checklist, ticked
.env.example              # every env var documented
```

Env vars (document in `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ALLOWED_DOMAIN=nxtwave.co.in`,
`ADMIN_EMAILS=nalamasa.sanjay@nxtwave.co.in`, `SENTRY_DSN`,
`UPSTASH_REDIS_REST_URL/TOKEN` (if used), `NEXT_PUBLIC_APP_URL`.

---

## 16. Deployment (must be documented step-by-step in README)

1. Create Supabase project; run migrations (`supabase db push`) + seed; deploy
   edge functions; schedule cron; configure Google OAuth provider + redirect
   URLs + the domain auth hook.
2. Create Google Cloud OAuth client (Web), set authorized origins/redirects to
   the Vercel domain and Supabase callback; restrict to the Workspace.
3. Deploy web app to Vercel; set all env vars; connect the custom domain.
4. Configure Resend domain (SPF/DKIM) and `EMAIL_FROM`.
5. Smoke-test the full flow in production; document rollback.

---

## 17. Acceptance criteria (Definition of Done — verify each)

- [ ] Only `@nxtwave.co.in` Google accounts can sign in; verified server-side.
- [ ] Super admin can create a team, set its key, and appoint a manager.
- [ ] A user can request to join; the manager approves with a role + custom
      permissions; the user then has exactly those capabilities.
- [ ] A member of Team A **cannot** see, query, or open (`/tasks/<tag>`) any
      Team B task — proven by an RLS/e2e test, not just the UI.
- [ ] Tasks get unique `TEAMKEY-<n>` tags generated atomically under load.
- [ ] Assign/tag works; the "email on assign" toggle enqueues and sends via
      Resend; in-app notification appears in realtime.
- [ ] @mentioning a user from another team grants them access to **only that
      task** (as a watcher) and notifies them.
- [ ] Status/progress/remarks/due date all persist; overdue is flagged;
      deadline cron sends digests.
- [ ] Every mutation is authorized server-side and audited.
- [ ] Full test suite (unit + RLS + e2e) is green in CI; build passes; no
      TypeScript `any`; `pnpm audit` clean of high/critical.
- [ ] README lets a new dev deploy from scratch; `.env.example` complete;
      DECISIONS/SECURITY/PERF docs present.
- [ ] App is responsive, accessible (AA), themed, with proper loading/empty/
      error/permission-denied states everywhere.

Build the entire thing to these criteria. Start by scaffolding the repo and
Supabase migrations (schema → enums → functions → RLS → seed), prove isolation
with tests, then build the API and UI feature by feature, and finish with the
edge functions, CI, docs, and deployment guide.

// SECURITY: all live credentials have been moved OUT of this file into
// `.env.local` (which is gitignored). Do not paste secrets back into this
// document — it is meant to be shared/handed off. See `.env.local.template`
// for the list of variables and `CREDENTIALS_SETUP.md` for where each comes
// from. Supabase project ref: dpwubohfltgtdyyqinou.
 
 