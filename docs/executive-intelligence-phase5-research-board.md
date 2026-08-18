# Executive Command Intelligence — Phase 5: Research Board Intelligence

The final phase in the Executive Command Intelligence group. Phases 1-4
look at outputs, trends, reputation, and reviewer capacity; Phase 5 turns
to the editorial board itself — the humans making ACCEPT/REJECT/REVISIONS
calls. One tenant's own real numbers only, same posture as Phases 2-4 — no
cross-tenant comparison.

## What it answers

- **Board composition & activity** — distinct editors who have ever made a
  decision, and how many made at least one in the last 90 days.
- **Decision funnel** — counts by decision type (assign reviewers, request
  revisions, accept, reject, send to production), the accept rate (of
  accept/reject outcomes), and the share of all decisions that request
  revisions.
- **Timeliness** — average days from `Article.submittedAt` to an article's
  first `EditorialDecision`, plus how many articles are still awaiting a
  first decision and, for those, the average days they've been waiting so
  far.
- **Active caseload distribution** — editors bucketed by how many
  currently-active (submitted/under-review/revisions-required) articles
  they're the editor of record for (1, 2-3, 4-6, 7+), a count carrying 5
  or more, and a count of active articles with no decision yet (so no
  editor of record) — a concrete unassigned-queue signal.

Deliberately never renders a single fabricated "board health score" —
every number here is a real, live-computed count or rate, matching this
codebase's established "never an estimate" posture.

## Schema

No new schema. Reuses `EditorialDecision` (already the platform's
decision-of-record log: `articleId`, `editorId`, `decision`, `createdAt`)
and `Article.submittedAt`/`status`, scoped through the tenant's `Journal`
set exactly as Phases 2-4 already established.

An article's "editor of record" is derived, not stored: the editor of its
most recent `EditorialDecision` row. Articles with zero decisions have no
editor of record and count toward `unassignedActiveCount` instead.

## API

`GET /api/admin/research-board` — `TENANT_SCOPED_ADMIN_ROLES`, same
tenantId-resolution convention as Phases 1-4: TENANT_ADMIN is confined to
`session.tenantId`; SUPER_ADMIN must pass an explicit `?tenantId=`. Runs
inside `withRlsContext`. `src/lib/research-board-intelligence.ts`'s
`computeResearchBoardIntelligence` resolves the tenant's journal IDs, then
reads `Article` and `EditorialDecision` rows for articles under those
journals.

## UI

`research-board-tab.tsx` (Executive Command Intelligence group, alongside
Phases 1-4) — composition/funnel and timeliness cards, plus an active
caseload distribution bar chart (plain CSS-width-percentage bars, no
charting library, matching Phases 2-4's tabs). SUPER_ADMIN gets the same
institution picker as Phases 1-4's tabs.

## Explicit non-goals (Phase 5)

- **No composite board health score.** Every figure shown is a real,
  independently interpretable count or rate — no single 0-100 index
  blending activity, speed, and caseload.
- **No cross-tenant board comparison.** Same posture as Phases 2-4:
  SUPER_ADMIN picks exactly one institution at a time.
- **No per-editor naming or leaderboard.** Caseload and activity are
  aggregate distributions only, same posture as Phase 4's reviewer
  workload view — this is board capacity planning, not a performance
  review.
- **No automated decision routing or editor reassignment.** Phase 5
  surfaces the numbers; acting on an overload or an unassigned queue is
  still an editor decision made elsewhere in the existing editorial
  queue tools.
- **No stored snapshot history**, same posture as Phases 1-4 — recomputed
  fresh from live rows on every request.

## Executive Command Intelligence — complete

With Phase 5, all five sub-features are shipped: Research Benchmarking
Intelligence (Phase 1), Board-Level Research Intelligence (Phase 2),
Institutional Reputation Intelligence (Phase 3), Reviewer Marketplace
Intelligence (Phase 4), and Research Board Intelligence (Phase 5) — one
sidebar group, five lenses on the same research enterprise, every figure a
real, live-computed number.
