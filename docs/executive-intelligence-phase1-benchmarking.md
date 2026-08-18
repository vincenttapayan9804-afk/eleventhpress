# Executive Command Intelligence — Phase 1: Research Benchmarking

Executive Command Intelligence answers "how is our research ecosystem doing,
against real data, at a glance" for institutional leadership. Phase 1
answers the specific question "how does our research ecosystem compare
with institutions of similar size?" — every later phase in this module
(Board-Level Intelligence, Institutional Reputation, Reviewer Marketplace,
Research Board project workspaces) either surfaces a distilled view of the
same aggregation engine this phase builds, or is a genuinely separate
subsystem layered on top of it. Building the comparison engine once here,
rather than per-phase, avoids computing the same metrics twice under two
different names.

## What it answers

"How does our research ecosystem compare with institutions of similar
size?" — across funding, publications, citations, collaborations, research
areas, commercialization (patents), impact, internationalization, open
research (datasets), and researcher productivity. Every figure is a real,
live-computed count against `Article`/`Grant`/`Patent`/`DatasetLink`/`User`
(`src/lib/research-benchmark.ts`) — never an estimate, matching this
codebase's established posture (COUNTER/SUSHI, `research-lab-activity`).

## Peer bands

"Similar size" is a fixed, documented bucket on published-article count
(`PEER_BANDS` in `research-benchmark.ts`): Emerging (0-9), Growing (10-49),
Established (50-199), Leading (200+). This is deliberately static rather
than a dynamic quartile split — a tenant's band should not silently shift
because other tenants signed up or churned, or period-over-period
comparison becomes meaningless. Published-article count was chosen because
it's the primary research-output signal `RankingsTab` already uses
platform-wide.

## Privacy posture

A tenant only ever sees its own exact numbers plus its peer band's
aggregate/median (`computeTenantBenchmark`'s `PeerAggregate`). It never
sees another tenant's raw, identifiable figures — you cannot use this to
reverse-engineer a specific competitor's standing, only where you sit
relative to the band as a whole.

## Schema

One new, deliberately minimal model: `Patent` (title, applicationNo,
status, filedDate, grantedDate, optional articleId link, tenantId). Not a
full IP-management system — no assignee/inventor/jurisdiction tracking, no
filing-office integration — just enough real, countable data to feed the
commercialization metric. `Tenant.patents[]` is the inverse relation. Every
other metric reuses existing schema: `Grant` (funding), `Article` (citations,
publications, disciplines, multi-author collaboration ratio via the
`authors` JSON array), `DatasetLink` (open research), `User.country`
(internationalization, distinct author countries), `Article.correspondingAuthorId`
(researcher productivity).

## API

`GET /api/admin/benchmarking` — `TENANT_SCOPED_ADMIN_ROLES`
(SUPER_ADMIN/TENANT_ADMIN). TENANT_ADMIN is confined to its own tenant
(`session.tenantId`); SUPER_ADMIN must pass an explicit `?tenantId=` (there
is no implicit "platform-wide" view here, unlike `RankingsTab` — a
benchmark is inherently "us vs. peers," which needs a specific "us"). Runs
inside `withRlsContext`, same as every other tenant-scoped admin route.

## UI

`benchmarking-tab.tsx` (Analytics & Reporting group) — a comparison table
(you vs. peer median per metric, with an "above/below/at median" badge)
plus summary cards for publications, research-area breadth, and
collaboration ratio. Follows `rankings-tab.tsx`'s Card/Badge/`apiFetch`
pattern.

## RLS

`Patent` joins the existing tenant-scoped `FOREACH` loop in
`prisma/rls.sql` (verified idempotent — running the script twice produces
no diff on the second run).

## Explicit non-goals (Phase 1)

- **No dynamic/quartile peer bands.** Bands are fixed thresholds, not
  computed from the current tenant population, for the stability reason
  above.
- **No historical trend line.** Like `RankingsTab`/COUNTER, this is a live
  snapshot, not a stored time series — a "growth over time" view is a
  distinct, later capability (Board-Level Intelligence, Phase 2).
- **Single-currency funding caveat.** `fundingTotal` sums `Grant.amount`
  across currencies as raw numbers (no FX conversion) — an honest
  limitation stated directly in the UI's row label, not hidden.
- **No cross-institution drill-down.** A tenant sees the band aggregate
  only, never a ranked list of individual peers — see Privacy posture
  above.
