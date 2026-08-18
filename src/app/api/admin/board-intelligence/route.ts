import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";
import { computeBoardIntelligence } from "@/lib/board-intelligence";

/**
 * GET /api/admin/board-intelligence
 * Executive Command Intelligence Phase 2 — Board-Level Research Intelligence.
 * TENANT_ADMIN is confined to its own tenant (session.tenantId); a
 * ?tenantId= query param is accepted only from SUPER_ADMIN, matching
 * /api/admin/benchmarking's convention (requireTenantScope's pattern
 * elsewhere). Returns one tenant's own trend/compliance data only — never
 * another tenant's.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  let tenantId: string | null;
  if (session.role === "TENANT_ADMIN") {
    tenantId = session.tenantId ?? null;
  } else {
    tenantId = req.nextUrl.searchParams.get("tenantId");
  }
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  try {
    const result = await withRlsContext(session, (tx) => computeBoardIntelligence(tx, tenantId!));
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === "Tenant not found") {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    throw e;
  }
}
