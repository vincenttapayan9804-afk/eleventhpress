import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/departments
 * EP University OS Phase 1 — lightweight, non-admin listing of the
 * caller's own tenant's departments, so any authenticated role (not just
 * TENANT_SCOPED_ADMIN_ROLES) can populate a department picker for
 * self-service profile assignment (PATCH /api/auth/me). Deliberately
 * separate from /api/admin/departments, which is admin-gated.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!session.tenantId) return NextResponse.json({ departments: [] });

  const departments = await withRlsContext(session, (tx) =>
    tx.department.findMany({
      where: { tenantId: session.tenantId! },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, parentDepartmentId: true },
    })
  );

  return NextResponse.json({ departments });
}
