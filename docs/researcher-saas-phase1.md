# Researcher SaaS — Phase 1

The per-user counterpart to Commercial Layer Phase 0 (org-level `Tenant`
plans): a monthly-quota pricing layer on top of the existing Research Lab
tooling (Research Gap Finder, PRISMA systematic-review drafting, audio
transcription), scoped to an individual researcher's own account rather
than their tenant.

## What shipped

- `User.researchPlan` — nullable `String`, same permissive-default
  convention as `Tenant.plan`. Every account before this phase, and any
  account never explicitly moved onto a plan, has `researchPlan: null`
  and is **fully unlimited** on every Research Lab tool — zero behavior
  change unless an operator opts an account in.
- `src/lib/researcher-plans.ts` — the plan catalog: `RESEARCHER_FREE`,
  `RESEARCHER_PRO`, `RESEARCHER_TEAM`, each with a monthly run cap per
  module (Gap Finder, PRISMA draft, transcription). Pure data.
- `src/lib/researcher-quota.ts` — `checkResearcherQuota(userId, moduleKey)`
  counts that module's `ResearchLabDocument`/`TranscriptionJob` rows
  created since the start of the current calendar month (UTC) and compares
  against the plan's cap. `getResearcherUsage(userId)` returns a full
  snapshot across every module, for display.
- Wired into the three POST routes that actually run an LLM/Whisper job:
  `POST /api/research-lab/gap-analysis`, `.../prisma-draft`,
  `.../transcription` — each returns `429` with a clear message once the
  caller's monthly cap is reached. Reads (`GET`) and the corpus-wide
  `/api/corpus-chat` route are untouched — see Non-goals.
- `PATCH /api/admin/users/[id]/research-plan` — SUPER_ADMIN-only, same
  posture as the tenant pricing fields in Phase 0 (moving a real account
  onto a paid plan is a billing action). Writes an `AuditLog` row.
- `GET /api/research-lab/quota` — any authenticated session reads their
  own plan + per-module usage/limit, for the dashboard usage banner.
- `ResearcherUsageBanner` in `research-lab-tab.tsx` — renders only when
  the account has an explicit plan (`planLabel` non-null); invisible for
  every pre-existing account.
- Tests: `src/lib/researcher-quota.test.ts` (10 cases) — no-plan/missing
  user/unknown-plan-key all resolve to unlimited, per-module isolation,
  per-user isolation, transcription reading from the right table.

## Why "Ask the Corpus" isn't in the quota catalog

`POST /api/corpus-chat` has no login requirement — it's public, same as
the rest of the open-access reading experience — so there's no `userId`
to meter a monthly cap against. It keeps its existing per-IP rate limit
(`checkRateLimit`) instead of joining this per-account system.

## Non-goals for this phase

- No self-serve plan purchase/checkout flow — `researchPlan` is set by a
  SUPER_ADMIN via the admin route today, same as Phase 0's tenant pricing.
  Wiring `RESEARCHER_PLANS` into the existing `Subscription`/`Invoice`
  billing tables (Stripe et al.) is a separate, later step.
- No enforcement on `GET` history/export/share routes — those were never
  metered; only the three "runs an LLM job" POST routes are.
- No quota reset/rollover UI — the cap is a rolling calendar-month count
  computed on read, not a stored/decremented balance.
- No relationship to `Tenant.plan`/`TenantEntitlement` (Phase 0) — the two
  systems are orthogonal: an org's `Tenant.plan` gates Executive Command
  Intelligence modules; an individual's `researchPlan` gates their own
  Research Lab run volume. A user can be on neither, either, or both.
