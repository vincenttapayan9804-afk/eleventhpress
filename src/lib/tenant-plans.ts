/**
 * Commercial Layer Phase 0 — plan catalog for the two org-level SMART-model
 * revenue engines that map onto a Tenant: "EP University" (University SaaS)
 * and "EP Publisher Cloud" (Publisher infrastructure). A Tenant can be
 * either kind of customer, so both live in one catalog keyed by
 * Tenant.plan.
 *
 * This is pure data — assigning a plan (PATCH /api/admin/tenants/[id])
 * stores `plan`/`pricePerYear` and upserts TenantEntitlement rows from
 * `defaultModules` below (see src/lib/tenant-entitlements.ts). It does not
 * itself charge anything; there is no Invoice/Subscription linkage in this
 * phase (see docs/commercial-layer-phase0.md's non-goals).
 *
 * `priceRangeUsd` is the catalog list-price band a sales conversation
 * starts from; the actual contracted `Tenant.pricePerYear` is a separate,
 * per-tenant number that may fall outside it for a negotiated deal.
 */

export const MODULE_KEYS = {
  DEPARTMENTS: "departments",
  RESEARCH_LAB: "research_lab",
  CUSTOM_DOMAINS: "custom_domains",
  ETHICS_TRACKING: "ethics_tracking",
  GRANTS_INTELLIGENCE: "grants_intelligence",
  BENCHMARKING: "benchmarking",
  BOARD_INTELLIGENCE: "board_intelligence",
  REPUTATION_INTELLIGENCE: "reputation_intelligence",
  REVIEWER_MARKETPLACE: "reviewer_marketplace",
  RESEARCH_BOARD_INTELLIGENCE: "research_board_intelligence",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

export const ALL_MODULE_KEYS: readonly ModuleKey[] = Object.values(MODULE_KEYS);

/** Human-readable labels for the admin UI's entitlement toggles. */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  [MODULE_KEYS.DEPARTMENTS]: "Departmental org structure",
  [MODULE_KEYS.RESEARCH_LAB]: "Eleventh Research Lab",
  [MODULE_KEYS.CUSTOM_DOMAINS]: "Custom domains",
  [MODULE_KEYS.ETHICS_TRACKING]: "Ethics / IRB / COI tracking",
  [MODULE_KEYS.GRANTS_INTELLIGENCE]: "Grant & funder intelligence",
  [MODULE_KEYS.BENCHMARKING]: "Research benchmarking",
  [MODULE_KEYS.BOARD_INTELLIGENCE]: "Board-level research intelligence",
  [MODULE_KEYS.REPUTATION_INTELLIGENCE]: "Institutional reputation intelligence",
  [MODULE_KEYS.REVIEWER_MARKETPLACE]: "Reviewer marketplace intelligence",
  [MODULE_KEYS.RESEARCH_BOARD_INTELLIGENCE]: "Research board intelligence",
};

export interface TenantPlanDefinition {
  key: string;
  label: string;
  engine: "UNIVERSITY_SAAS" | "PUBLISHER_CLOUD";
  priceRangeUsd: readonly [number, number];
  defaultModules: readonly ModuleKey[];
  // Researcher SaaS Phase 2 — a University SaaS plan bundles this
  // per-seat researcher plan (a key from src/lib/researcher-plans.ts) for
  // every member of the tenant who has no explicit User.researchPlan of
  // their own (see resolveEffectiveResearchPlan in researcher-quota.ts).
  // Only takes effect while the tenant is also entitled to the
  // RESEARCH_LAB module — a tenant with that module toggled off bundles
  // nothing, same as if the field were absent. Publisher Cloud has no
  // researcher seats to bundle, so it's omitted (undefined) rather than
  // set to a plan that doesn't apply to that engine.
  bundledResearcherPlan?: string;
}

export const TENANT_PLANS: Record<string, TenantPlanDefinition> = {
  UNIVERSITY_SMALL: {
    key: "UNIVERSITY_SMALL",
    label: "EP University — Small institution",
    engine: "UNIVERSITY_SAAS",
    priceRangeUsd: [15_000, 40_000],
    defaultModules: [MODULE_KEYS.DEPARTMENTS, MODULE_KEYS.RESEARCH_LAB],
    bundledResearcherPlan: "RESEARCHER_PRO",
  },
  UNIVERSITY_MID: {
    key: "UNIVERSITY_MID",
    label: "EP University — Mid-size institution",
    engine: "UNIVERSITY_SAAS",
    priceRangeUsd: [50_000, 150_000],
    defaultModules: [
      MODULE_KEYS.DEPARTMENTS,
      MODULE_KEYS.RESEARCH_LAB,
      MODULE_KEYS.CUSTOM_DOMAINS,
      MODULE_KEYS.ETHICS_TRACKING,
      MODULE_KEYS.GRANTS_INTELLIGENCE,
    ],
    bundledResearcherPlan: "RESEARCHER_TEAM",
  },
  UNIVERSITY_LARGE: {
    key: "UNIVERSITY_LARGE",
    label: "EP University — Large research university",
    engine: "UNIVERSITY_SAAS",
    priceRangeUsd: [200_000, 750_000],
    defaultModules: ALL_MODULE_KEYS,
    bundledResearcherPlan: "RESEARCHER_TEAM",
  },
  PUBLISHER_CLOUD: {
    key: "PUBLISHER_CLOUD",
    label: "EP Publisher Cloud",
    engine: "PUBLISHER_CLOUD",
    priceRangeUsd: [10_000, 100_000],
    defaultModules: [MODULE_KEYS.CUSTOM_DOMAINS, MODULE_KEYS.RESEARCH_LAB],
  },
};

export const TENANT_PLAN_KEYS: readonly string[] = Object.keys(TENANT_PLANS);

export function getTenantPlan(planKey: string | null | undefined): TenantPlanDefinition | null {
  if (!planKey) return null;
  return TENANT_PLANS[planKey] ?? null;
}
