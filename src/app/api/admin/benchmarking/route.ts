import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { withRlsContext } from "@/lib/db-rls";
import { computeTenantBenchmark } from "@/lib/research-benchmark";
import { hasModuleEntitlement } from "@/lib/tenant-entitlements";
import { MODULE_KEYS } from "@/lib/tenant-plans";

/**
 * GET /api/admin/benchmarking
 * Executive Command Intelligence Phase 1 — Research Benchmarking.
 * TENANT_ADMIN is confined to its own tenant (session.tenantId); a
 * ?tenantId= query param is accepted only from SUPER_ADMIN, matching
 * requireTenantScope's convention elsewhere. Returns the requesting
 * tenant's own real metrics plus its peer band's aggregate/median only —
 * never another tenant's raw identifiable numbers (see
 * research-benchmark.ts's computeTenantBenchmark).
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

  // Commercial Layer Phase 0 — gated only once a tenant is on an explicit
  // plan; a tenant with no plan set (every tenant before this phase) is
  // never blocked. See src/lib/tenant-entitlements.ts.
  if (!(await hasModuleEntitlement(tenantId, MODULE_KEYS.BENCHMARKING))) {
    return NextResponse.json({ error: "Research benchmarking is not included in this tenant's plan" }, { status: 403 });
  }

  try {
    const result = await withRlsContext(session, (tx) => computeTenantBenchmark(tx, tenantId!));
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === "Tenant not found") {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    throw e;
  }
}
