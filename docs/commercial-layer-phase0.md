# Commercial Layer — Phase 0

Adds pricing/entitlement data on top of the multi-tenancy foundation that
already exists (Whitelabel Phases 1-8, EP University OS Phases 1-4,
Executive Command Intelligence Phases 1-5). This is the first phase of the
corrected SMART-model compliance roadmap: the gap it closes is commercial
(no plan/price/entitlement data existed), not architectural (tenancy,
data isolation, and the module surface itself were already real).

## What shipped

- **`Tenant.plan` / `Tenant.pricePerYear` / `Tenant.billingOwnerId`** —
  three nullable fields on the existing `Tenant` model. `plan` is a catalog
  key from `src/lib/tenant-plans.ts`; `pricePerYear` is the actual
  contracted annual price (may differ from the catalog's list-price band
  for a negotiated deal); `billingOwnerId` is a display/attribution
  pointer to the `User` responsible for the commercial relationship —
  same posture as `Department.headUserId` and
  `Grant.principalInvestigatorUserId`, granting no permission of its own.
- **`src/lib/tenant-plans.ts`** — the plan catalog for the two org-level
  SMART-model engines that map onto a Tenant: EP University (Small/Mid/
  Large, $15K–$750K+/yr) and EP Publisher Cloud ($10K–$100K+/yr). Each
  plan lists its default module entitlements.
- **`TenantEntitlement` model** — per-tenant, per-module toggle
  (`tenantId`, `moduleKey`, `enabled`). Joined `prisma/rls.sql`'s existing
  tenant-scoped `FOREACH` loop from day one, same as every other
  tenant-scoped table added since EP University OS Phase 1.
- **`src/lib/tenant-entitlements.ts`** — `hasModuleEntitlement` /
  `getTenantEntitlements`. A module with no `TenantEntitlement` row is
  entitled by default; only an explicit `enabled: false` row blocks it.
  `syncTenantEntitlements` upserts a full explicit row set (or deletes all
  rows, on clearing the plan) whenever `Tenant.plan` changes.
- **`PATCH /api/admin/tenants/[id]`** extended to accept `plan`,
  `pricePerYear`, `billingOwnerId` — SUPER_ADMIN-only, same as `status`/
  `maxUsers`. Setting `plan` syncs entitlements to that plan's defaults.
- **`PATCH /api/admin/tenants/[id]/entitlements`** — SUPER_ADMIN-only,
  one-module override independent of the plan sync (e.g. a one-off add-on
  outside a tenant's base plan).
- **Gated routes**: the five Executive Command Intelligence endpoints
  (`/api/admin/benchmarking`, `/board-intelligence`,
  `/reputation-intelligence`, `/reviewer-marketplace`, `/research-board`)
  each check `hasModuleEntitlement` before computing their result,
  returning 403 with an upgrade-oriented message when the module isn't
  entitled.
- **Admin UI**: the Tenants dashboard tab gained a Plan & billing section
  per tenant — plan selector, price override, billing-owner user ID, and a
  chip row to toggle each module's entitlement individually.

## Why null is the safe default, not a migration-pending state

Every tenant that existed before this phase has `plan: null` and zero
`TenantEntitlement` rows. `hasModuleEntitlement` treats an absent row as
entitled, so introducing entitlements changes zero behavior for any
existing tenant until an operator explicitly assigns a plan or toggles a
module. This mirrors `Tenant.maxUsers`'s existing null-means-unlimited
convention rather than introducing a new pattern.

## Non-goals (explicitly out of scope for this phase)

- **No self-serve tenant creation.** `POST /api/admin/tenants` stays
  SUPER_ADMIN-only. Turning "EP University"/"EP Publisher Cloud" into a
  self-serve signup flow is a larger, separate phase — it changes who can
  create a tenant at all, not just what a tenant can see.
- **No RLS activation.** `prisma/rls.sql`'s policies (including the new
  `TenantEntitlement` policy) remain staged, not enforced — production
  still connects as the table-owning role, per the six-step runbook in
  `docs/row-level-security.md`. That's a manual production database
  cutover, not a code change, and stays a separate, explicitly-approved
  step.
- **No billing/invoice integration.** `pricePerYear` is a stored number an
  operator sets manually; it does not create an `Invoice`, charge a
  payment provider, or drive any recurring billing. Wiring a Tenant-level
  plan into the existing `Invoice`/`Subscription`/payment-provider stack
  (`src/lib/pricing.ts`, `src/lib/payments/*`) is future work.
- **No entitlement enforcement outside the five intelligence routes.**
  Departments, ethics tracking, and grants/funders remain ungated in this
  phase even though they appear in the plan catalog's default module
  lists — the catalog data is real and the UI reflects it, but only the
  five intelligence routes actually check it yet. Extending enforcement to
  the rest of the catalog is incremental, low-risk follow-up work once
  this pattern is validated live.
- **No `ApiKey`/`ApiClient` model.** That's EP Knowledge API — a later
  phase in the roadmap, unrelated to org-level tenant plans.
