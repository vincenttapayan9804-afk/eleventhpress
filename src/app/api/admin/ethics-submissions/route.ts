import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/admin/ethics-submissions
 * EP University OS Phase 3 — tenant-wide review queue, same posture as
 * GET /api/admin/departments: SUPER_ADMIN sees every tenant (or one, via
 * ?tenantId=), TENANT_ADMIN is confined to session.tenantId regardless of
 * the query param.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const requestedTenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  let tenantId: string | undefined;
  if (session.role === "TENANT_ADMIN") {
    tenantId = session.tenantId ?? undefined;
  } else {
    tenantId = requestedTenantId;
  }

  const submissions = await withRlsContext(session, (tx) =>
    tx.ethicsSubmission.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true, slug: true } },
        article: { select: { id: true, title: true } },
      },
    })
  );

  return NextResponse.json({ submissions });
}
