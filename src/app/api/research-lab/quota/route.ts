import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { getResearcherUsage } from "@/lib/researcher-quota";
import { getResearcherPlan, RESEARCH_MODULE_LABELS } from "@/lib/researcher-plans";

/**
 * GET /api/research-lab/quota
 * Researcher SaaS Phase 1 — self-service usage snapshot so the Research
 * Lab UI can show "X of Y used this month" when an account has an
 * explicit researchPlan. Any authenticated session may read their own
 * usage; there's nothing here a role gate needs to restrict.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const usage = await getResearcherUsage(session.userId);
  const plan = getResearcherPlan(usage.plan);

  return NextResponse.json({
    plan: usage.plan,
    planLabel: plan?.label ?? null,
    modules: Object.entries(usage.modules).map(([moduleKey, v]) => ({
      moduleKey,
      label: RESEARCH_MODULE_LABELS[moduleKey as keyof typeof RESEARCH_MODULE_LABELS],
      used: v.used,
      limit: v.limit,
    })),
  });
}
