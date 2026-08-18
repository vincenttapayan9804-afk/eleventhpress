# EP University OS — Phase 5: Institutional Rankings & Comparative Research Dashboards

Cross-institution and cross-department comparative analytics, computed
live from data every prior phase already produces: published articles'
existing `views`/`downloads`/`shares`/`citations` counters (Whitelabel-era
fields, `citations` refreshed from OpenAlex per `src/lib/citation-metrics.ts`),
Whitelabel Phase 5's `Journal.tenantId` transitive scoping, and Phase 1's
`Department`/`User.departmentId`. No new Prisma models, no backfill, no
behavior change for a tenant with no published articles.

## What shipped

- **`GET /api/admin/rankings/institutions`** — SUPER_ADMIN only, same
  platform-only posture as `GET /api/admin/tenants`. Aggregates every
  tenant's `PUBLISHED` articles (grouped via `Journal.tenantId`) into
  article count, total views/downloads/shares/citations, and average
  citations per article. Sortable via `?sortBy=citations|views|downloads|shares|articles`.
  There is no TENANT_ADMIN variant — see "Why this is platform-only" below.
- **`GET /api/admin/rankings/departments`** — `TENANT_SCOPED_ADMIN_ROLES`,
  same tenantId-resolution shape as `GET /api/admin/departments`
  (TENANT_ADMIN confined to its own tenant; SUPER_ADMIN may pass
  `?tenantId=` or omit it for a platform-wide grouping). Aggregates
  `PUBLISHED` articles by the corresponding author's `Department`, with an
  "Unassigned" bucket (`departmentId: null`) for articles whose
  corresponding author has no department on file, so totals stay honest
  against the tenant's real published-article count rather than silently
  dropping rows.
- **Dashboard UI** — `Institutional rankings`
  (`src/components/dashboard/rankings-tab.tsx`, SUPER_ADMIN only): a
  sortable cross-tenant leaderboard. `Research dashboard`
  (`src/components/dashboard/research-dashboard-tab.tsx`,
  `TENANT_SCOPED_ADMIN_ROLES`): a within-tenant department comparison
  table.
- Both reads wrapped in `withRlsContext(session, ...)` — `Journal` and
  `Department` are both already governed by `prisma/rls.sql`'s
  tenant-scoped `FOREACH` loop, and its policy explicitly allows
  `app.role = 'SUPER_ADMIN'` through regardless of `app.tenant_id`, so
  wrapping the cross-tenant SUPER_ADMIN case is correct today and stays
  correct once the RLS cutover happens — no route-level special-casing
  needed.

## Why this is computed live, not stored

Every number here (views, downloads, shares, citations) is already a
live-updated column on `Article` — there is nothing to snapshot that isn't
already current. This mirrors `src/lib/counter.ts`'s COUNTER 5 SUSHI
reports, which have always derived platform/title/item usage reports from
the same counters at request time rather than maintaining a separate
reporting table. A ranking history/trend-over-time table (e.g. "citations
this quarter vs last quarter") is a real, reasonable future increment, but
requires deciding a snapshot cadence and retention policy that's
speculative until there's a concrete need for trend lines rather than a
point-in-time comparison — not built here.

## Why institutional rankings are platform-only (no TENANT_ADMIN view)

A TENANT_ADMIN seeing a named, ranked comparison of another institution's
publication output/citation counts is a real cross-tenant data exposure,
not just a UI convenience question — every other cross-tenant view in this
codebase (`GET /api/admin/tenants`, tenant health/purge) is SUPER_ADMIN-only
for the same reason. If a future need arises for institutions to
opt in to a public/shared leaderboard, that's an explicit product decision
(consent, anonymization option, opt-out) to make deliberately, not a
default this phase should assume.

## Why there's no new role

Same reasoning Phase 1 (`DEPARTMENT_ADMIN`), Phase 3, and Phase 4
(`GRANT_ADMIN`) used to defer a narrower role: reading a comparative
dashboard rides on `TENANT_SCOPED_ADMIN_ROLES`/`SUPER_ADMIN` because
there's no existing "research office analyst" identity in this codebase to
gate a narrower read-only role against yet.

## Zero-backfill story

Both routes read existing counters through existing relations
(`Article.journal.tenantId`, `Article.author.departmentId`) — there is no
new column and nothing to backfill. A tenant with zero published articles,
or zero departments, sees an empty/zero-row table and nothing else
changes.

## Explicit non-goals (Phase 5)

- Ranking snapshots, trend lines, or historical comparison — see "Why this
  is computed live" above.
- A public-facing leaderboard or opt-in cross-institution visibility — see
  "Why institutional rankings are platform-only" above.
- Impact-factor-style weighted scoring, field-normalized citation
  percentiles, or any composite ranking formula — the UI presents raw
  totals only; a normalized/weighted score is a deliberate methodology
  decision this phase does not make on the platform's behalf.
- Per-user (individual researcher) rankings — Phase 5 stays at the
  institution/department granularity the roadmap named; author-level
  leaderboards already exist separately (the Council of Experts Directory).
- Any change to how `views`/`downloads`/`shares`/`citations` are computed
  or incremented — this phase only reads and aggregates them.
