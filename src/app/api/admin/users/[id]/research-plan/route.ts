import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { RESEARCHER_PLAN_KEYS } from "@/lib/researcher-plans";

const ResearchPlanChangeSchema = z.object({ researchPlan: z.string().max(50).nullable() });

/**
 * PATCH /api/admin/users/[id]/research-plan
 * Researcher SaaS Phase 1. SUPER_ADMIN-only, same posture as the platform
 * pricing fields on PATCH /api/admin/tenants/[id] (Commercial Layer Phase
 * 0) — moving a real account onto/off a paid plan is a billing action, not
 * an ordinary tenant-admin user-management task. Body: { researchPlan:
 * "RESEARCHER_FREE" | "RESEARCHER_PRO" | "RESEARCHER_TEAM" | null }.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const { id } = await params;
  const parsed = await parseBody(req, ResearchPlanChangeSchema);
  if (!parsed.ok) return parsed.response;
  const { researchPlan } = parsed.data;
  if (researchPlan !== null && !RESEARCHER_PLAN_KEYS.includes(researchPlan)) {
    return NextResponse.json({ error: `researchPlan must be one of: ${RESEARCHER_PLAN_KEYS.join(", ")}, or null` }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await db.user.update({ where: { id }, data: { researchPlan } });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "RESEARCH_PLAN_CHANGE",
      entityType: "USER",
      entityId: id,
      metadata: JSON.stringify({ from: target.researchPlan, to: researchPlan, targetEmail: target.email }),
    },
  });

  return NextResponse.json({
    user: { id: updated.id, email: updated.email, fullName: updated.fullName, researchPlan: updated.researchPlan },
  });
}
