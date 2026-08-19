import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { ALL_MODULE_KEYS } from "@/lib/tenant-plans";
import { getTenantEntitlements } from "@/lib/tenant-entitlements";

/**
 * PATCH /api/admin/tenants/[id]/entitlements
 * Commercial Layer Phase 0 — SUPER_ADMIN-only override of a single module's
 * entitlement, independent of the plan-driven defaults set by PATCH
 * /api/admin/tenants/[id] (src/lib/tenant-entitlements.ts's
 * syncTenantEntitlements). Lets an operator grant/revoke one module without
 * changing the tenant's plan — e.g. a one-off add-on for a customer whose
 * base plan doesn't include it.
 */
const UpdateEntitlementSchema = z.object({
  moduleKey: z.enum(ALL_MODULE_KEYS as [string, ...string[]]),
  enabled: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const parsed = await parseBody(req, UpdateEntitlementSchema);
  if (!parsed.ok) return parsed.response;

  await db.tenantEntitlement.upsert({
    where: { tenantId_moduleKey: { tenantId: id, moduleKey: parsed.data.moduleKey } },
    create: { tenantId: id, moduleKey: parsed.data.moduleKey, enabled: parsed.data.enabled },
    update: { enabled: parsed.data.enabled },
  });

  return NextResponse.json({ entitlements: await getTenantEntitlements(id) });
}
