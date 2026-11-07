import { db } from "./db";

/** Which tenant platform an account belongs to — returned at sign-in so the client can switch to it (see workspace-client.ts). */
export async function workspaceOf(tenantId: string | null | undefined): Promise<{ tenantId: string; isPlatform: boolean } | null> {
  if (!tenantId) return null;
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, isPlatform: true } }).catch(() => null);
  return tenant ? { tenantId: tenant.id, isPlatform: tenant.isPlatform } : null;
}
