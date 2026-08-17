import { db } from "@/lib/db";

/**
 * Whitelabel Phase 6 — plan/quota enforcement.
 *
 * Only checks Tenant.maxUsers today (the one quota dimension this pass
 * implements — see the schema comment on Tenant.maxUsers for why storage/
 * content quotas aren't included yet). Returns true when the tenant has
 * room for one more user, or when it has no cap (maxUsers is null) or
 * isn't resolved at all (a request with no tenant context is never capped
 * by this — it lands on the platform tenant, which ships uncapped).
 */
export async function tenantHasUserCapacity(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return true;

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { maxUsers: true } });
  if (!tenant || tenant.maxUsers == null) return true;

  const userCount = await db.user.count({ where: { tenantId } });
  return userCount < tenant.maxUsers;
}
