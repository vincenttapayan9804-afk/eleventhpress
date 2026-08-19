# Researcher SaaS — Phase 2 (University SaaS bundling)

Connects the two commercial layers that Phase 0 and Phase 1 shipped
independently: an org's `Tenant.plan` (Commercial Layer Phase 0) and an
individual's `User.researchPlan` (Researcher SaaS Phase 1). A university
tenant on a paid University SaaS plan now bundles a per-seat researcher
plan for every member who has no explicit plan of their own — so a
department doesn't need a SUPER_ADMIN to individually opt in every
researcher after the institution itself signs a contract.

## What shipped

- `TenantPlanDefinition.bundledResearcherPlan` (`src/lib/tenant-plans.ts`)
  — an optional catalog key from `RESEARCHER_PLANS`. Set on the three
  University SaaS tiers: `UNIVERSITY_SMALL` → `RESEARCHER_PRO`,
  `UNIVERSITY_MID`/`UNIVERSITY_LARGE` → `RESEARCHER_TEAM`. Left unset on
  `PUBLISHER_CLOUD`, which has no researcher seats to bundle.
- `resolveEffectiveResearchPlan(userId)` in `src/lib/researcher-quota.ts`
  — the single place that now decides which plan governs a user's quota:
  1. An explicit `User.researchPlan` always wins — a university (or
     SUPER_ADMIN) can still upgrade/downgrade an individual member
     directly, exactly as in Phase 1.
  2. Otherwise, if the user belongs to a tenant whose `Tenant.plan` has a
     `bundledResearcherPlan` **and** that tenant is still entitled to the
     `research_lab` module (`TenantEntitlement`, Phase 0's existing gate),
     the bundled plan applies.
  3. Otherwise: no plan, fully unlimited — same as Phase 1's default.
  `checkResearcherQuota` and `getResearcherUsage` both call this instead
  of reading `User.researchPlan` directly; no other code changed.
- `GET /api/research-lab/quota` now also returns `planSource`
  (`"EXPLICIT" | "BUNDLED" | null`) alongside the existing `plan`/
  `planLabel`/`modules`, so the UI can label a bundled plan differently
  from a personally-assigned one.
- `ResearcherUsageBanner` (`research-lab-tab.tsx`) shows "(via your
  institution)" next to the plan name when `planSource === "BUNDLED"`.

No schema changes — this phase is pure library wiring on top of the
Phase 0 (`Tenant.plan`/`TenantEntitlement`) and Phase 1
(`User.researchPlan`) columns that already exist.

## Zero behavior change, verified

At the time this phase shipped, no tenant in the database had a `plan`
assigned (`select * from "Tenant" where plan is not null` — zero rows),
so introducing `bundledResearcherPlan` changed nothing for any existing
account. The bundling only ever activates when an operator explicitly
moves a tenant onto a University SaaS plan — the same "opt-in only"
posture Phase 0 and Phase 1 both used for their own fields.

If an operator later assigns `UNIVERSITY_SMALL`/`MID`/`LARGE` to an
already-active tenant, every member without their own `researchPlan`
newly becomes subject to the bundled monthly cap. That is the intended
effect of the feature (buying the institutional plan is what grants the
per-seat quota), not a regression — same as assigning any `Tenant.plan`
newly enforces that plan's `TenantEntitlement` set.

## Non-goals for this phase

- No UI for a TENANT_ADMIN to change which researcher plan their tenant
  bundles, or to override it per-department — bundling follows the
  catalog's fixed `Tenant.plan → bundledResearcherPlan` mapping only.
- No stacking or highest-of-two logic — an explicit `User.researchPlan`
  always fully overrides the bundle rather than being combined with it.
- No visibility for a TENANT_ADMIN into aggregate researcher usage across
  their bundled seats — `GET /api/research-lab/quota` is still a
  self-service, single-user view (Phase 1's scope).
- No self-serve institutional checkout — assigning `Tenant.plan` is still
  a SUPER_ADMIN action via `PATCH /api/admin/tenants/[id]` (Phase 0's
  existing posture, unchanged).
