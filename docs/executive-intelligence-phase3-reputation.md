# Executive Command Intelligence — Phase 3: Institutional Reputation Intelligence

Phase 1 answers "how do we compare to similar-sized peers right now" and
Phase 2 answers "how is our research enterprise trending, and where are
the compliance risks." Phase 3 answers a third, distinct board-meeting
question: "is our research enterprise reputable?" — editorial rigor,
directory/indexing legitimacy, post-publication integrity record, and
reviewer network depth. One tenant's own real numbers only, same posture
as Phase 2 — no cross-tenant comparison here either.

## What it answers

- **Editorial rigor** — submitted/accepted/rejected/under-review counts,
  acceptance rate among decided submissions, and average
  submission-to-decision turnaround (`Article.submittedAt` →
  `Article.acceptedAt` for accepted articles, or the `EditorialDecision`
  REJECT row's `createdAt` for rejected ones).
- **Directory / indexing coverage** — per-directory (ROAD, ISI,
  RESEARCHBIB, CITEFACTOR, SAJI) indexed/in-progress/rejected/not-applied
  counts across the tenant's journals, from the existing `DirectoryListing`
  model (already used by the journal-management indexing workflow).
- **Post-publication integrity record** — `Article.integrityStatus`
  (NORMAL/CORRECTED/UNDER_CONCERN/RETRACTED) tallied across the tenant's
  published articles, plus a clean-record rate. Reuses the same
  Correction-derived status field the public article page already shows;
  nothing new tracked.
- **Reviewer network** — distinct reviewer count, completed review count,
  average reviewer overall score, and average review turnaround
  (`Review.createdAt` → `Review.completedAt`).

Deliberately never renders a single fabricated "reputation score" —
every number here is a real, live-computed count or rate, matching this
codebase's established "never an estimate" posture (research-benchmark.ts,
board-intelligence.ts).

## Schema

No new schema. Reuses `Article`, `EditorialDecision`, `DirectoryListing`,
and `Review` — all already reachable from a tenant's `Journal` set, and
`Journal` was already tenant-scoped and RLS-wired by earlier phases. No
`prisma/rls.sql` changes were needed.

## API

`GET /api/admin/reputation-intelligence` — `TENANT_SCOPED_ADMIN_ROLES`,
same tenantId-resolution convention as Phases 1-2: TENANT_ADMIN is
confined to `session.tenantId`; SUPER_ADMIN must pass an explicit
`?tenantId=`. Runs inside `withRlsContext`.
`src/lib/reputation-intelligence.ts`'s `computeReputationIntelligence`
first resolves the tenant's journal IDs (the RLS-governed query), then
filters `Article`/`EditorialDecision`/`DirectoryListing`/`Review` by that
ID set — the same "scope through Journal" pattern Phase 2's
`board-intelligence.ts` already established for `Article`.

## UI

`reputation-intelligence-tab.tsx` (Executive Command Intelligence group,
alongside Phases 1-2) — editorial rigor and integrity-record cards, a
per-directory indexing coverage list, and a reviewer network card.
SUPER_ADMIN gets the same institution picker as Phases 1-2's tabs.

## Explicit non-goals (Phase 3)

- **No composite reputation score.** Every figure shown is a real,
  independently interpretable count or rate — there is no single 0-100
  "reputation index" blending them, since any such weighting would be
  editorial opinion dressed up as a metric.
- **No cross-tenant reputation comparison.** Same posture as Phase 2:
  SUPER_ADMIN picks exactly one institution at a time.
- **No external reputation signals** (news mentions, social sentiment,
  third-party ranking inclusion). Everything here comes from this
  platform's own editorial, indexing, and review records — nothing
  scraped or estimated from outside sources.
- **No stored snapshot history**, same posture as Phases 1-2 — recomputed
  fresh from live rows on every request.
