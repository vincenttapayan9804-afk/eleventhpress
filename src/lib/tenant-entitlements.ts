import { db } from "@/lib/db";
import { ALL_MODULE_KEYS, getTenantPlan, type ModuleKey } from "@/lib/tenant-plans";

/**
 * Commercial Layer Phase 0 — module entitlement gate.
 *
 * Per-module, not per-tenant: a module with no TenantEntitlement row is
 * entitled by default, regardless of whether the tenant has other rows or
 * a plan assigned. This is what keeps introducing entitlements a
 * zero-behavior-change addition for every tenant that existed before this
 * phase (all of which have zero rows today), while still letting a single
 * module be granted or revoked in isolation (see the entitlements PATCH
 * route) without implicitly blocking every other module that happens to
 * have no row yet. Only an explicit `enabled: false` row ever blocks
 * access.
 */
export async function hasModuleEntitlement(tenantId: string | null | undefined, moduleKey: ModuleKey): Promise<boolean> {
  if (!tenantId) return true;

  const row = await db.tenantEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  });
  return row ? row.enabled : true;
}

export async function getTenantEntitlements(tenantId: string): Promise<Record<string, boolean>> {
  const rows = await db.tenantEntitlement.findMany({ where: { tenantId } });
  const result: Record<string, boolean> = {};
  for (const key of ALL_MODULE_KEYS) result[key] = true;
  for (const row of rows) result[row.moduleKey] = row.enabled;
  return result;
}

/**
 * Upserts TenantEntitlement rows to match a plan's default module set.
 * Called whenever an operator assigns/changes Tenant.plan
 * (PATCH /api/admin/tenants/[id]). Every catalog module gets an explicit
 * row (enabled true/false) so the admin UI can show and individually
 * override each toggle afterward, rather than only writing the "on" rows
 * and leaving the rest implicit.
 */
export async function syncTenantEntitlements(tenantId: string, planKey: string | null): Promise<void> {
  if (!planKey) {
    // Clearing the plan reverts to the "no rows = fully entitled" default —
    // delete rather than write all-false rows, so getTenantEntitlements
    // reports every module open again instead of everything blocked.
    await db.tenantEntitlement.deleteMany({ where: { tenantId } });
    return;
  }

  const plan = getTenantPlan(planKey);
  const enabledSet = new Set<string>(plan ? plan.defaultModules : []);

  await db.$transaction(
    ALL_MODULE_KEYS.map((moduleKey) =>
      db.tenantEntitlement.upsert({
        where: { tenantId_moduleKey: { tenantId, moduleKey } },
        create: { tenantId, moduleKey, enabled: enabledSet.has(moduleKey) },
        update: { enabled: enabledSet.has(moduleKey) },
      })
    )
  );
}
