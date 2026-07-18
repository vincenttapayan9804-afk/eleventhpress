/**
 * CSRF protection for cookie-based sessions. Phase 1 moved auth off
 * Authorization headers onto a cookie the browser attaches automatically —
 * which reintroduces CSRF risk for state-changing requests, since a
 * cross-site page can trigger a request that carries the victim's cookie
 * without their knowledge.
 *
 * Double-submit cookie pattern: no server-side token storage needed. This
 * cookie is deliberately NOT httpOnly (client JS must read it to echo it
 * back as a header) — that's safe because an attacker on a different
 * origin can't read this cookie (same-origin policy) or set the matching
 * header themselves, so they can't forge a valid pair regardless.
 */
export const CSRF_COOKIE_NAME = "epip_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Uses the Web Crypto API (not Node's `crypto` module) so this works
 * unchanged in both the Edge middleware runtime and Node route handlers. */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
