"use client";

/**
 * Switching between the official site and a whitelabel tenant's platform
 * on the same host. The page's branding (colours, logo, scoped content) is
 * rendered server-side from the session, so after signing in as a member
 * of another tenant, or signing out of one, the page reloads once to pick
 * up the right platform.
 */

interface SignedInUser {
  tenantId?: string | null;
  workspace?: { tenantId: string; isPlatform: boolean } | null;
}

function body(): DOMStringMap | null {
  return typeof document !== "undefined" ? document.body?.dataset ?? null : null;
}

/** True (and navigates) when the signed-in account belongs to a different tenant platform than the page shows. */
export function enterWorkspaceIfNeeded(user: SignedInUser, next = "/?view=dashboard"): boolean {
  const data = body();
  if (!data || !user.workspace || user.workspace.isPlatform) return false;
  if (data.wsSource === "domain") return false;
  if (user.workspace.tenantId === data.tenantId) return false;
  window.location.assign(next);
  return true;
}

/** After sign-out: leave a tenant platform that was shown only because of the session. */
export function leaveSessionWorkspace(): boolean {
  const data = body();
  if (data?.wsSource !== "session") return false;
  window.location.assign("/");
  return true;
}
