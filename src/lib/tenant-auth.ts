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

/**
 * Whitelabel Phase 7 — editorial tenant separation. Authorizes an
 * editorial action (workflow decision, reviewer assignment, triage, ...)
 * against a specific article. SUPER_ADMIN acts on any article,
 * platform-wide, as always — the same posture requireTenantScope already
 * gives it above. Any other EDITOR/ASSOCIATE_EDITOR/REVIEWER session is
 * confined to articles whose Journal belongs to that user's own tenant:
 * the visibility boundary Phase 5 already draws for Article/Journal is now
 * enforced at the point of action too, not only at read time.
 *
 * A null on either side (`session.tenantId` for a pre-Phase-1 session,
 * `articleTenantId` for an article whose Journal predates
 * Journal.tenantId) means "no tenant context to compare" and is allowed
 * through — matching every other tenant check in this codebase's fail-open
 * posture for genuinely unresolvable tenant identity, not a bypass for
 * tenants that do have one.
 */
export function isSameEditorialTenant(session: SessionPayload, articleTenantId: string | null | undefined): boolean {
  if (session.role === "SUPER_ADMIN") return true;
  if (!session.tenantId || !articleTenantId) return true;
  return session.tenantId === articleTenantId;
}
