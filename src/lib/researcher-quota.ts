import { db } from "@/lib/db";
import { getResearcherPlan, RESEARCH_MODULE_KEYS, ALL_RESEARCH_MODULE_KEYS, type ResearchModuleKey } from "@/lib/researcher-plans";
import { MODULE_KEYS, getTenantPlan } from "@/lib/tenant-plans";
import { hasModuleEntitlement } from "@/lib/tenant-entitlements";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function countThisMonth(userId: string, moduleKey: ResearchModuleKey): Promise<number> {
  const since = startOfCurrentMonth();
  if (moduleKey === RESEARCH_MODULE_KEYS.TRANSCRIPTION) {
    return db.transcriptionJob.count({ where: { userId, createdAt: { gte: since } } });
  }
  return db.researchLabDocument.count({ where: { userId, kind: moduleKey, createdAt: { gte: since } } });
}

/**
 * Researcher SaaS Phase 2 — resolves which plan actually governs a user's
 * quota. An explicit User.researchPlan always wins (a tenant can still
 * upgrade/downgrade an individual member directly, same as before this
 * phase). Only when a user has no explicit plan do we fall back to their
 * tenant's bundled researcher plan (see Tenant.plan -> bundledResearcherPlan
 * in tenant-plans.ts) — and only while that tenant is still entitled to
 * the RESEARCH_LAB module. A user with no tenant, a tenant with no plan,
 * a plan with no bundle, or a tenant whose RESEARCH_LAB entitlement was
 * revoked all resolve to null (unlimited), same as Phase 1.
 */
async function resolveEffectiveResearchPlan(
  userId: string
): Promise<{ planKey: string | null; source: "EXPLICIT" | "BUNDLED" | null }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { researchPlan: true, tenantId: true } });
  if (!user) return { planKey: null, source: null };

  if (user.researchPlan) return { planKey: user.researchPlan, source: "EXPLICIT" };

  if (!user.tenantId) return { planKey: null, source: null };

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { plan: true } });
  const tenantPlan = getTenantPlan(tenant?.plan);
  if (!tenantPlan?.bundledResearcherPlan) return { planKey: null, source: null };

  const entitled = await hasModuleEntitlement(user.tenantId, MODULE_KEYS.RESEARCH_LAB);
  if (!entitled) return { planKey: null, source: null };

  return { planKey: tenantPlan.bundledResearcherPlan, source: "BUNDLED" };
}

/**
 * Researcher SaaS Phase 1 — per-user, per-module monthly quota check.
 * A user with no effective researcher plan (explicit or bundled) is
 * always unlimited — zero behavior change unless an operator opts an
 * account, or its tenant, into a plan.
 */
export async function checkResearcherQuota(
  userId: string,
  moduleKey: ResearchModuleKey
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const { planKey } = await resolveEffectiveResearchPlan(userId);
  const plan = getResearcherPlan(planKey);
  if (!plan) return { allowed: true, used: 0, limit: null };

  const limit = plan.monthlyQuotas[moduleKey];
  if (limit == null) return { allowed: true, used: 0, limit: null };

  const used = await countThisMonth(userId, moduleKey);
  return { allowed: used < limit, used, limit };
}

/** Usage snapshot across every quota-checked module, for a self-service display. */
export async function getResearcherUsage(userId: string): Promise<{
  plan: string | null;
  planSource: "EXPLICIT" | "BUNDLED" | null;
  modules: Record<ResearchModuleKey, { used: number; limit: number | null }>;
}> {
  const { planKey, source } = await resolveEffectiveResearchPlan(userId);
  const plan = getResearcherPlan(planKey);

  const modules = {} as Record<ResearchModuleKey, { used: number; limit: number | null }>;
  for (const moduleKey of ALL_RESEARCH_MODULE_KEYS) {
    const limit = plan?.monthlyQuotas[moduleKey] ?? null;
    const used = limit == null ? 0 : await countThisMonth(userId, moduleKey);
    modules[moduleKey] = { used, limit };
  }

  return { plan: planKey, planSource: source, modules };
}
