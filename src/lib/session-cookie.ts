/**
 * Which cookie carries the sign-in for the site a request is on.
 *
 * Whitelabel tenant portals opened through /t/<slug> share the official
 * site's origin, so a single session cookie would make every portal and the
 * official site one sign-in: signing out of eleventhpress.org would sign the
 * visitor out of every tenant platform too. Each site therefore keeps its own
 * cookie:
 *
 * - official site (no portal open): `epip_session`
 * - tenant portal `<slug>`: `epip_session__<slug>`
 *
 * The portal in use is the `ep_portal` cookie set by /t/<slug>. A tenant on
 * its own domain or subdomain is a different host, so its cookies are
 * already separate; it has no portal cookie and uses `epip_session` there.
 *
 * Kept free of Node-only imports so src/proxy.ts can use it.
 */

/** Cookie on the official site's own sign-in (and on tenant custom domains). */
export const BASE_SESSION_COOKIE_NAME = "epip_session";

/** Cookie remembering which tenant portal a visitor opened via /t/<slug>. */
export const PORTAL_COOKIE_NAME = "ep_portal";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The portal slug, when it is a well-formed tenant slug. */
export function validPortalSlug(slug: string | null | undefined): string | null {
  const s = slug?.trim().toLowerCase();
  return s && SLUG_PATTERN.test(s) ? s : null;
}

/** Session cookie name for a portal slug (or the official site for none). */
export function sessionCookieNameFor(portalSlug: string | null | undefined): string {
  const slug = validPortalSlug(portalSlug);
  return slug ? `${BASE_SESSION_COOKIE_NAME}__${slug}` : BASE_SESSION_COOKIE_NAME;
}

/** Reads one cookie from a raw `Cookie` header. */
export function cookieFromHeader(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    const raw = part.slice(i + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Portal slug of a request, from its `Cookie` header. */
export function portalSlugFromHeaders(headers: Headers): string | null {
  return validPortalSlug(cookieFromHeader(headers.get("cookie"), PORTAL_COOKIE_NAME));
}

/** Session cookie name for the site this request is on. */
export function sessionCookieNameForHeaders(headers: Headers): string {
  return sessionCookieNameFor(portalSlugFromHeaders(headers));
}
