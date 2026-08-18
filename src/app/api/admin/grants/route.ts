import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES, GRANT_STATUS_OPTIONS } from "@/lib/roles";
import { parseBody } from "@/lib/validate";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET/POST /api/admin/grants
 * EP University OS Phase 4 — tenant-scoped grants-office record keeping,
 * same admin posture and tenant-confinement shape as
 * /api/admin/departments and /api/admin/funders.
 */

const CreateGrantSchema = z.object({
  tenantId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(300),
  awardNumber: z.string().trim().max(120).optional(),
  funderId: z.string().min(1).optional(),
  funderNameFreeText: z.string().trim().max(200).optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().trim().toUpperCase().length(3).optional(),
  status: z.enum(GRANT_STATUS_OPTIONS as [string, ...string[]]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  principalInvestigatorUserId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  articleId: z.string().min(1).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const requestedTenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const departmentId = req.nextUrl.searchParams.get("departmentId") ?? undefined;

  let tenantId: string | undefined;
  if (session.role === "TENANT_ADMIN") {
    tenantId = session.tenantId ?? undefined;
  } else {
    tenantId = requestedTenantId;
  }

  const grants = await withRlsContext(session, (tx) =>
    tx.grant.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        funder: { select: { id: true, name: true, externalId: true } },
        department: { select: { id: true, name: true, slug: true } },
        article: { select: { id: true, title: true } },
        principalInvestigator: { select: { id: true, fullName: true, email: true } },
      },
    })
  );

  return NextResponse.json({ grants });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const parsed = await parseBody(req, CreateGrantSchema);
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

  let tenantId: string;
  if (session.role === "TENANT_ADMIN") {
    if (parsed.data.tenantId && parsed.data.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Forbidden — not an admin of this tenant" }, { status: 403 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ error: "Your session has no tenant context" }, { status: 400 });
    }
    tenantId = session.tenantId;
  } else {
    if (!parsed.data.tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }
    tenantId = parsed.data.tenantId;
  }

  const tenantScope = requireTenantScope(req.headers, tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!tenantScope.ok) return NextResponse.json({ error: tenantScope.error }, { status: tenantScope.status });

  if (funderId) {
    const funder = await db.funder.findUnique({ where: { id: funderId } });
    if (!funder || funder.tenantId !== tenantId) {
      return NextResponse.json({ error: "funderId must belong to this tenant" }, { status: 400 });
    }
  }

  if (departmentId) {
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department || department.tenantId !== tenantId) {
      return NextResponse.json({ error: "departmentId must belong to this tenant" }, { status: 400 });
    }
  }

  if (principalInvestigatorUserId) {
    const pi = await db.user.findUnique({ where: { id: principalInvestigatorUserId } });
    if (!pi || pi.tenantId !== tenantId) {
      return NextResponse.json({ error: "principalInvestigatorUserId must belong to this tenant" }, { status: 400 });
    }
  }

  if (articleId) {
    const article = await db.article.findUnique({ where: { id: articleId }, include: { journal: { select: { tenantId: true } } } });
    if (!article || (article.journal.tenantId && article.journal.tenantId !== tenantId)) {
      return NextResponse.json({ error: "articleId must belong to this tenant" }, { status: 400 });
    }
  }

  const grant = await db.grant.create({
    data: {
      tenantId,
      title,
      awardNumber: awardNumber ?? null,
      funderId: funderId ?? null,
      funderNameFreeText: funderNameFreeText ?? null,
      amount: amount ?? null,
      currency: currency ?? null,
      status: status ?? "ACTIVE",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      principalInvestigatorUserId: principalInvestigatorUserId ?? null,
      departmentId: departmentId ?? null,
      articleId: articleId ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ grant }, { status: 201 });
}
