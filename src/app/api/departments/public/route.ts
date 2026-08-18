import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/departments/public
 * EP University OS Phase 2 — public, unauthenticated directory of the
 * current request's tenant's departments (department landing pages need
 * something to link out from that isn't gated behind a login, unlike
 * GET /api/departments, which is deliberately session-gated for the
 * self-service profile picker). Returns an empty list for a tenant with no
 * departments (every non-university tenant, and any university tenant that
 * hasn't set any up yet) rather than an error — same "additive, invisible
 * until adopted" posture as the rest of Phase 1/2.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  if (!tenant) return NextResponse.json({ departments: [] });

  const departments = await withTenantRlsContext(tenant.id, (tx) =>
    tx.department.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        parentDepartmentId: true,
        _count: { select: { members: true } },
      },
    })
  );

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      parentDepartmentId: d.parentDepartmentId,
      memberCount: d._count.members,
    })),
  });
}
