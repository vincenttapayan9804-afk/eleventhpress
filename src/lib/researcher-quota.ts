import { db } from "@/lib/db";
import { getResearcherPlan, RESEARCH_MODULE_KEYS, ALL_RESEARCH_MODULE_KEYS, type ResearchModuleKey } from "@/lib/researcher-plans";

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
 * Researcher SaaS Phase 1 — per-user, per-module monthly quota check.
 * A user with no researchPlan set (every account before this phase, and
 * anyone never explicitly moved onto a plan) is always unlimited — zero
 * behavior change unless an operator opts an account in.
 */
export async function checkResearcherQuota(
  userId: string,
  moduleKey: ResearchModuleKey
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { researchPlan: true } });
  const plan = getResearcherPlan(user?.researchPlan);
  if (!plan) return { allowed: true, used: 0, limit: null };

  const limit = plan.monthlyQuotas[moduleKey];
  if (limit == null) return { allowed: true, used: 0, limit: null };

  const used = await countThisMonth(userId, moduleKey);
  return { allowed: used < limit, used, limit };
}

/** Usage snapshot across every quota-checked module, for a self-service display. */
export async function getResearcherUsage(userId: string): Promise<{
  plan: string | null;
  modules: Record<ResearchModuleKey, { used: number; limit: number | null }>;
}> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { researchPlan: true } });
  const plan = getResearcherPlan(user?.researchPlan);

  const modules = {} as Record<ResearchModuleKey, { used: number; limit: number | null }>;
  for (const moduleKey of ALL_RESEARCH_MODULE_KEYS) {
    const limit = plan?.monthlyQuotas[moduleKey] ?? null;
    const used = limit == null ? 0 : await countThisMonth(userId, moduleKey);
    modules[moduleKey] = { used, limit };
  }

  return { plan: user?.researchPlan ?? null, modules };
}
