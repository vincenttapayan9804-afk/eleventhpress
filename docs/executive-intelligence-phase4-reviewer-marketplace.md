# Executive Command Intelligence — Phase 4: Reviewer Marketplace Intelligence

Phases 1-3 look outward or upward from the research enterprise (peer
comparison, trend/compliance, reputation). Phase 4 turns inward on the
two-sided marketplace that makes peer review possible at all: is the
reviewer pool big enough, responsive enough, and evenly loaded enough to
keep the editorial pipeline moving? One tenant's own real numbers only,
same posture as Phases 2-3 — no cross-tenant comparison here either.

## What it answers

- **Reviewer pool & invitation funnel** — distinct reviewers ever invited,
  reviewers active (completed a review) in the last 180 days, and the
  invited → accepted/declined/in-progress/completed funnel with response
  rate, decline rate, and completion rate.
- **Timeliness** — count of active (accepted/in-progress) assignments past
  their `dueDate`, and the share of completed reviews finished at or
  before their due date.
- **Workload distribution** — reviewers bucketed by current active
  (accepted/in-progress) assignment count (1, 2-3, 4-6, 7+), plus a count
  of reviewers carrying 5 or more — a concrete overload signal an editor
  can act on.
- **Expertise coverage** — distinct expertise keyword count and the top 8
  keywords by reviewer count, parsed from `User.expertise`'s existing
  comma-separated field (already used for reviewer matching elsewhere).

Deliberately never renders a single fabricated "marketplace health score"
— every number here is a real, live-computed count or rate, matching this
codebase's established "never an estimate" posture (research-benchmark.ts,
board-intelligence.ts, reputation-intelligence.ts).

## Schema

No new schema. Reuses `Review` (status/dueDate/createdAt/completedAt) and
`User.expertise`, scoped through the tenant's `Journal` set exactly as
Phases 2-3 already established (`Journal` was already tenant-scoped and
RLS-wired).

## API

`GET /api/admin/reviewer-marketplace` — `TENANT_SCOPED_ADMIN_ROLES`, same
tenantId-resolution convention as Phases 1-3: TENANT_ADMIN is confined to
`session.tenantId`; SUPER_ADMIN must pass an explicit `?tenantId=`. Runs
inside `withRlsContext`. `src/lib/reviewer-marketplace.ts`'s
`computeReviewerMarketplace` resolves the tenant's journal IDs, then reads
`Review` rows for articles under those journals plus the distinct
reviewers' `User.expertise`.

## UI

`reviewer-marketplace-tab.tsx` (Executive Command Intelligence group,
alongside Phases 1-3) — pool/funnel and timeliness cards, plus a workload
distribution bar chart and an expertise coverage bar chart (plain
CSS-width-percentage bars, no charting library, matching
`board-intelligence-tab.tsx`/`reputation-intelligence-tab.tsx`).
SUPER_ADMIN gets the same institution picker as Phases 1-3's tabs.

## Explicit non-goals (Phase 4)

- **No composite marketplace health score.** Every figure shown is a
  real, independently interpretable count or rate — no single 0-100
  index blending pool size, responsiveness, and workload.
- **No cross-tenant marketplace comparison.** Same posture as Phases 2-3:
  SUPER_ADMIN picks exactly one institution at a time.
- **No reviewer-level drill-down or naming.** Workload and timeliness are
  shown as aggregate distributions, not a per-reviewer leaderboard — this
  is a capacity-planning view, not a performance-review tool.
- **No automated reviewer reassignment or invitation throttling.** Phase 4
  surfaces the numbers; acting on an overload or a stalled funnel is still
  an editor decision made elsewhere in the existing reviewer queue tools.
- **No stored snapshot history**, same posture as Phases 1-3 — recomputed
  fresh from live rows on every request.
