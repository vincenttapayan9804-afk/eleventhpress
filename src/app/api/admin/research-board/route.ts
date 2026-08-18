import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";
import { computeResearchBoardIntelligence } from "@/lib/research-board-intelligence";

/**
 * GET /api/admin/research-board
 * Executive Command Intelligence Phase 5 — Research Board Intelligence.
 * Same tenantId-resolution convention as Phases 1-4: TENANT_ADMIN is
 * confined to session.tenantId; SUPER_ADMIN must pass an explicit
 * ?tenantId=.
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
    const result = await withRlsContext(session, (tx) => computeResearchBoardIntelligence(tx, tenantId!));
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === "Tenant not found") {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    throw e;
  }
}
