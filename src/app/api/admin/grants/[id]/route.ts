import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES, GRANT_STATUS_OPTIONS } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const UpdateGrantSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  awardNumber: z.string().trim().max(120).nullable().optional(),
  funderId: z.string().min(1).nullable().optional(),
  funderNameFreeText: z.string().trim().max(200).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3).nullable().optional(),
  status: z.enum(GRANT_STATUS_OPTIONS as [string, ...string[]]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  principalInvestigatorUserId: z.string().min(1).nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  articleId: z.string().min(1).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

/** PATCH/DELETE /api/admin/grants/[id] — tenant-scoped, same posture as /api/admin/departments/[id]. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = await db.grant.findUnique({ where: { id } });
  if (!grant) return NextResponse.json({ error: "Grant not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, grant.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, UpdateGrantSchema);
  if (!parsed.ok) return parsed.response;
  const {
    title,
    awardNumber,
    funderId,
    funderNameFreeText,
    amount,
    currency,
    status,
    startDate,
    endDate,
    principalInvestigatorUserId,
    departmentId,
    articleId,
    notes,
  } = parsed.data;

  if (funderId) {
    const funder = await db.funder.findUnique({ where: { id: funderId } });
    if (!funder || funder.tenantId !== grant.tenantId) {
      return NextResponse.json({ error: "funderId must belong to this tenant" }, { status: 400 });
    }
  }

  if (departmentId) {
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department || department.tenantId !== grant.tenantId) {
      return NextResponse.json({ error: "departmentId must belong to this tenant" }, { status: 400 });
    }
  }

  if (principalInvestigatorUserId) {
    const pi = await db.user.findUnique({ where: { id: principalInvestigatorUserId } });
    if (!pi || pi.tenantId !== grant.tenantId) {
      return NextResponse.json({ error: "principalInvestigatorUserId must belong to this tenant" }, { status: 400 });
    }
  }

  if (articleId) {
    const article = await db.article.findUnique({ where: { id: articleId }, include: { journal: { select: { tenantId: true } } } });
    if (!article || (article.journal.tenantId && article.journal.tenantId !== grant.tenantId)) {
      return NextResponse.json({ error: "articleId must belong to this tenant" }, { status: 400 });
    }
  }

  const updated = await db.grant.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(awardNumber !== undefined && { awardNumber }),
      ...(funderId !== undefined && { funderId }),
      ...(funderNameFreeText !== undefined && { funderNameFreeText }),
      ...(amount !== undefined && { amount }),
      ...(currency !== undefined && { currency }),
      ...(status !== undefined && { status }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(principalInvestigatorUserId !== undefined && { principalInvestigatorUserId }),
      ...(departmentId !== undefined && { departmentId }),
      ...(articleId !== undefined && { articleId }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json({ grant: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = await db.grant.findUnique({ where: { id } });
  if (!grant) return NextResponse.json({ error: "Grant not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, grant.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await db.grant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
