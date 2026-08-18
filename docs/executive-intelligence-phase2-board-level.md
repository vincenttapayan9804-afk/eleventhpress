# Executive Command Intelligence — Phase 2: Board-Level Research Intelligence

Phase 1 (`docs/executive-intelligence-phase1-benchmarking.md`) answers "how
do we compare to similar-sized peers right now" — a live snapshot, no
history. Phase 2 answers the board-meeting question Phase 1 explicitly
deferred: "how is our research enterprise trending, and where are the
compliance risks?" One tenant's own real numbers only — there is nothing to
compare across tenants here, so no peer-aggregation/anonymization posture
is needed (unlike Phase 1).

## What it answers

- **Headline totals** — publications, citations, funding, active grants,
  patents, active researchers — the same live-computed style as Phase 1's
  `own` metrics, but standing alone rather than benchmarked.
- **Quarterly trend** — publication count and grant funding, over the last
  6 quarters, bucketed from `Article.publishedAt` / `Grant.createdAt`. Not
  a stored time series or snapshot table — computed fresh from live rows on
  every request, same posture as Phase 1 and COUNTER/SUSHI.
- **Top research disciplines** — the 5 disciplines with the most published
  articles, by count.
- **Ethics/IRB compliance** — submitted/approved/rejected/pending counts,
  approval rate among decided submissions, and average days from
  submission to decision (`EthicsSubmission.submittedAt` →
  `.reviewedAt`), built on the Phase 3 University OS ethics model
  (`docs/university-os-phase3.md`).

## Schema

No new schema. Reuses `Article` (via `Journal.tenantId`), `Grant`,
`Patent`, and `EthicsSubmission` — every table Phase 2 reads was already
tenant-scoped and RLS-wired by earlier phases, so no `prisma/rls.sql`
changes were needed either.

## API

`GET /api/admin/board-intelligence` — `TENANT_SCOPED_ADMIN_ROLES`
(SUPER_ADMIN/TENANT_ADMIN), same tenantId-resolution convention as Phase
1's `/api/admin/benchmarking`: TENANT_ADMIN is confined to
`session.tenantId`; SUPER_ADMIN must pass an explicit `?tenantId=`. Runs
inside `withRlsContext`, same as every other tenant-scoped admin route.
`src/lib/board-intelligence.ts`'s `computeBoardIntelligence` does all the
aggregation, mirroring `research-benchmark.ts`'s shape.

## UI

`board-intelligence-tab.tsx` (Executive Command Intelligence group,
alongside Phase 1's benchmarking tab) — headline stat cards, two quarterly
trend bars (publications, funding), a top-disciplines bar list, and an
ethics-compliance card. SUPER_ADMIN gets the same institution picker as
Phase 1's tab (and for the same reason — no tenant of its own to imply).

## Explicit non-goals (Phase 2)

- **No stored snapshot history.** Trend points are recomputed from live
  rows on every request, exactly like Phase 1 — no new table capturing
  point-in-time snapshots. If a future phase needs data no longer
  reconstructible from live rows (e.g. headcount at a past date), that's a
  new capability, not a Phase 2 gap.
- **No cross-tenant board view.** Same posture as Phase 1: SUPER_ADMIN
  picks exactly one institution at a time, never an aggregate across all
  tenants.
- **No PDF/export "board pack."** This is a live dashboard, not a
  generated document — export is a distinct, later capability if ever
  requested.
- **Single-currency funding caveat**, same as Phase 1: funding trend sums
  `Grant.amount` across currencies as raw numbers, no FX conversion.
