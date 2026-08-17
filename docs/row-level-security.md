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
  **Whitelabel Phase 7 — partially wired, not yet complete.** The primary
  public list/browse endpoints are wrapped in `withTenantRlsContext`:
  `GET /api/books`, `/api/magazines`, `/api/podcasts`, `/api/media`,
  `/api/collections`, and `/api/articles` (the last of these was also a
  real, active tenant-isolation bug fixed in the same pass — it had never
  been scoped by tenant at all, so any visitor could browse every tenant's
  published articles from any tenant's site; see that route's Phase 7
  comment). **Still not wired:** the `[id]` single-record routes for each
  of those content types, the editorial/admin screens that read these
  tables (dashboards, workflow, export), and Journal's own read paths.
  Do not treat this list as complete — see the warning under Activation
  below before switching the runtime connection.

## Activation (the one manual, production-only step)

> **Before doing this for the tenant-scoped tables (Book/Magazine/Podcast/
> MediaPost/Collection/Journal/Article):** every read path on those tables
> must first be wrapped in `withRlsContext`/`withTenantRlsContext`, so
> `app.tenant_id` is actually set on every request that touches them.
> Phase 7 wired the primary public list endpoints (see above) but **not**
> the full set — plenty of `db.book.findMany()`-style calls elsewhere in
> the app (admin screens, `[id]` detail routes, editorial workflow, export)
> still aren't wrapped. If you switch the runtime connection to
> `app_runtime` before *all* of them are done, every one of those unwrapped
> calls will see `app.tenant_id` as unset and **every tenant-scoped table
> will return zero rows to everyone except SUPER_ADMIN** — including public
> visitors browsing a tenant's own site. This fails closed rather than
> leaking data, but it is a full outage of tenant-scoped content, not
> "extra defense-in-depth" — treat wiring the
> read paths as a hard prerequisite for this step, not an optional
> follow-up. Invoice/AuditLog are unaffected by this warning; their read
> paths are already wired in.

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
- **Wiring the Phase 5 tenant-table read paths into `withRlsContext` /
  `withTenantRlsContext`** — the policies and helper exist, but no route
  calls the helper yet (see the warning under Activation above). Today's
  actual tenant isolation on these tables is entirely application-layer
  (the `where: { tenantId }` filters added in Whitelabel Phases 4-5); this
  RLS layer is prepared but not yet the backstop it's designed to be.
- **Tenant-scoping `AuditLog` itself, or editorial roles
  (`EDITOR`/`REVIEWER`/etc.)** — both remain platform-wide. An editor
  account today can see and act on every tenant's submission queue; there
  is no per-tenant editorial staff separation. Whether that's the intended
  operating model (shared editorial back-office across tenants) or a gap
  to close is a product decision, not an engineering default — flagged for
  a future phase rather than assumed either way.
