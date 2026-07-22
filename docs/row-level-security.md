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

## Activation (the one manual, production-only step)

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
