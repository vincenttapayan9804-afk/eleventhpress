/**
 * Whitelabel Phase 4 — tenant-scoped authorization.
 *
 * requireRole() (src/lib/auth.ts) only answers "does this session have an
 * allowed role," which is enough for platform-wide gates (SUPER_ADMIN-only
 * routes) but not for TENANT_ADMIN: that role must additionally be confined
 * to the one tenant it belongs to. This wraps requireRole with that second
 * check so every tenant-scoped route enforces it the same way, rather than
 * hand-rolling a tenantId comparison at each call site.
 */
import { requireRole, type SessionPayload } from "./auth";

export type RequireTenantScopeResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Authorizes access to a specific tenant (`targetTenantId`). SUPER_ADMIN is
 * always allowed (platform-wide). TENANT_ADMIN is allowed only when its
 * session carries that exact tenantId — a TENANT_ADMIN session without a
 * tenantId (shouldn't happen in practice; defensive) or with a different
 * tenantId is forbidden. Any other role in `allowedRoles` (e.g. EDITOR,
 * for content routes that also accept the platform-wide editorial roles)
 * is authorized without a tenant check, matching requireRole's existing
 * behavior for those roles.
 */
export function requireTenantScope(
  headers: Headers,
  targetTenantId: string,
  allowedRoles: readonly string[]
): RequireTenantScopeResult {
  const auth = requireRole(headers, allowedRoles);
  if (!auth.ok) return auth;

  if (auth.session.role === "TENANT_ADMIN" && auth.session.tenantId !== targetTenantId) {
    return { ok: false, status: 403, error: "Forbidden — not an admin of this tenant" };
  }

  return auth;
}
