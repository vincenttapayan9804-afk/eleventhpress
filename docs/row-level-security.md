# Row Level Security (RLS)

Defense-in-depth on top of this app's existing application-layer
authorization (`requireRole()`, per-route ownership checks): Postgres-level
policies on the two tables that should never be readable cross-user or by
the public under any circumstance — `Invoice` (payment records) and
`AuditLog` (the security/audit trail).

This is **additive and inert by default** — merging the code that ships
alongside this doc changes no runtime behavior on its own. It follows the
same honest-gating convention as this app's other optional integrations
(Zenodo, iThenticate, Upstash rate limiting, VirusTotal): shippable
immediately, but only actually enforced once a real, manual production
step is completed. Nothing here should ever be described as "RLS is live"
until that step is done and verified.

## Why activation is a separate, manual step

Postgres RLS policies are bypassed entirely by:
- a table's **owner**, and
- any role with the **BYPASSRLS** attribute (including superusers).

The database role this app currently connects as (`POSTGRES_PRISMA_URL` /
`POSTGRES_URL_NON_POOLING`) is the same role that runs `prisma db push` —
it therefore **owns** every table, including `Invoice` and `AuditLog`.
Enabling RLS on those tables without also switching the app's runtime
connection to a different, restricted role has **zero enforcement effect**.
Shipping code that merely "enables RLS" while still connecting as the
owner would be exactly the kind of fabricated-security theater this
codebase's LiveMode pattern exists to avoid.

## What's already shipped (safe, no activation needed)

- `prisma/rls.sql` — idempotent SQL that creates a new, restricted
  `app_runtime` role (`NOLOGIN NOBYPASSRLS` — a real login password is set
  separately, never hardcoded into a file that lands in version control),
  grants it the full CRUD access the app needs to function, enables RLS on
  `Invoice`/`AuditLog`, and defines the actual policies.
- `src/lib/db-rls.ts` — a `withRlsContext(session, fn)` helper that runs a
  query inside a transaction with `app.user_id`/`app.role` set as
  Postgres session variables (via `set_config()`, parameterized — never
  string-interpolated) for that transaction only. Already wired into the
  Invoice/AuditLog **read** paths (`/api/dashboard`, `/api/billing/status`,
  `/api/crossref-log`). Calling it today is a harmless no-op: it sets a
  session variable nothing enforces yet, and changes no query results.
- **Whitelabel Phase 5 — tenant isolation policies.** `prisma/rls.sql` also
  enables RLS on `Book`, `Magazine`, `Podcast`, `MediaPost`, `Collection`,
  and `Journal` (each keyed on their `tenantId` column matching
  `app.tenant_id`), plus `Article` (keyed transitively through its
  `Journal.tenantId`, since `Article` has no `tenantId` column of its own —
  see prisma/schema.prisma's `Journal.tenantId` comment). `SUPER_ADMIN`
  bypasses all of them. `src/lib/db-rls.ts` adds `withTenantRlsContext
  (tenantId, fn)` — a session-free counterpart to `withRlsContext`, for the
  public/unauthenticated browsing reads on these tables (a visitor has a
  resolved tenant from the Host header but no session).
- **EP University OS Phase 1 — `Department`** joined this convention from
  day one rather than being retrofitted later: it has a direct `tenantId`
  column, so it was added straight into the same `FOREACH` loop as
  Book/Magazine/Podcast/MediaPost/Collection/Journal, and its one read path
  (`GET /api/admin/departments`, `GET /api/departments`) was wired into
  `withRlsContext`/`withTenantRlsContext` from the route's first commit.
- **EP University OS Phase 3 — `EthicsSubmission`** joined the same
  `FOREACH` loop the same way, for the same reason (direct `tenantId`
  column). Its two read paths (`GET /api/ethics-submissions`,
  `GET /api/admin/ethics-submissions`) were wired into
  `withTenantRlsContext`/`withRlsContext` from the route's first commit.
- **Whitelabel Phase 8 — the tenant-table policies are `FOR SELECT` only**
  (like `auditlog_read_privileged_only` above), not the original blanket
  `USING`/`WITH CHECK` that covered every command. `INSERT`/`UPDATE`/
  `DELETE` on `Book`/`Magazine`/`Podcast`/`MediaPost`/`Collection`/
  `Journal`/`Article` stay ungated at the database layer — write-side
  isolation is already enforced at the application layer (the
  `where: { tenantId }` filters and `isSameEditorialTenant` checks built
  across Whitelabel Phases 4-7). This matters because some write-heavy
  editorial routes (the article PUBLISH workflow, most notably) interleave
  DB writes with slow external calls — Crossref/Zenodo deposits, the
  pandoc-worker galley pipeline — that must never sit inside one held DB
  transaction; a write-inclusive RLS policy would force rearchitecting
  those pipelines purely to satisfy a defense-in-depth layer, which isn't a
  trade worth making. Restricting enforcement to reads keeps the
  activation prerequisite bounded to "every `SELECT` touching these tables
  sets `app.tenant_id` first" — and that prerequisite is now **complete**:
  every read of these tables anywhere in the app — public list/browse
  endpoints, `[id]` single-record routes, editorial/admin screens
  (dashboards, workflow, triage, purge, export), and Journal's own read
  paths (OAI-PMH, ONIX, ReDIF, sitemap, and friends) — runs inside
  `withRlsContext` or `withTenantRlsContext`. See the Activation section
  below for what that means for the actual switch.

## Activation (the one manual, production-only step)

> Every `SELECT` touching the tenant-scoped tables (Book/Magazine/Podcast/
> MediaPost/Collection/Journal/Article) is wrapped in `withRlsContext`/
> `withTenantRlsContext` as of Whitelabel Phase 8 — see above. Writes to
> those tables are intentionally not RLS-gated (also Phase 8 — see above),
> so they need no wrapping and don't affect this warning. If you still find
> an unwrapped `db.<model>.findX()`/`count()`/`aggregate()` call against one
> of these 7 models when you do this in the future (e.g. a new route added
> after this doc was last updated), wrap it first: an unwrapped read call
> sees `app.tenant_id` as unset once `app_runtime` is active, and **that
> one call will return zero rows to everyone except SUPER_ADMIN** — a
> silent, fails-closed content gap on just that path, not a leak. Grep for
> `db\.(book|magazine|magazineIssue|podcast|podcastEpisode|mediaPost|collection|journal|article|department)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|aggregate)\(`
> across `src/app` before activating, to confirm no new unwrapped call has
> landed since. Invoice/AuditLog are unaffected by any of this; their read
> paths have been wired in since before Phase 5.

1. Connect to the production database as an actual superuser/owner (e.g.
   via the provider's console — Vercel Storage, Neon, Supabase, etc.).
2. Run `prisma/rls.sql`.
3. Set a real password: `ALTER ROLE app_runtime WITH LOGIN PASSWORD '<a real, generated secret>';`
4. Build a new connection string using the `app_runtime` role instead of
   the owning role, and set it as the app's runtime `POSTGRES_PRISMA_URL` /
   `POSTGRES_URL_NON_POOLING` in Vercel's environment variables. Keep the
   original owner-role connection string available separately for any
   process that still needs to run DDL (`prisma db push`, future schema
   migrations) — `app_runtime` intentionally cannot alter schema.
5. Redeploy. From this point on, RLS is genuinely enforced: a bug in a
   future route that forgets its `WHERE userId = …` clause on `Invoice`,
   or that accidentally exposes `AuditLog` to a non-privileged role, is
   now caught at the database layer too, not just the application layer.
6. Verify: as a non-privileged test user, confirm `/api/billing/status`
   and `/api/dashboard` still return exactly that user's own invoices (not
   an empty list — an empty list would mean `app.user_id` isn't being set
   correctly, not that RLS is "working").

## Deliberately out of scope for this pass

- **`User` and `Institution`** — not RLS-protected. Both have real,
  intentional public-read surfaces (the Authors' Directory, editorial
  board listings, public author profile pages; institution name/domain
  shown in various public contexts) that a blanket "owner-or-admin-only"
  row policy would break. The actual sensitive material on those tables
  (OAuth tokens, SSO config, COUNTER API keys) is column-level, not
  row-level, risk — already addressed for OAuth tokens via
  `src/lib/field-encryption.ts`, and a candidate for its own follow-up
  rather than folded into this pass.
- **`AuditLog.create()` write paths** (~30 call sites across the app) —
  left unwrapped. Every one of them needs to succeed regardless of whose
  audit trail it's attributed to (that's what audit logging *is*), so the
  RLS `INSERT` policy stays permissive (`WITH CHECK (true)`) and doesn't
  need per-call-site session context. What RLS restricts is *reading* or
  *tampering with* the trail, not adding to it.
- **RLS enforcement on tenant-table writes** — deliberately scoped out for
  the reasons explained under Phase 8 above (`FOR SELECT`-only policies).
  Write-side tenant isolation is application-layer only: the
  `where: { tenantId }` filters (Whitelabel Phases 4-5) and
  `isSameEditorialTenant` checks (Whitelabel Phase 7). A bug in one of
  those app-layer checks on a write path is not caught by this RLS layer
  the way a same-kind bug on a read path now is.
