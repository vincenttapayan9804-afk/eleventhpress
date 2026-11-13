import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, sessionCookieOptions, type SessionPayload } from "@/lib/auth";
import { PORTAL_COOKIE_NAME, portalSlugFromHeaders, sessionCookieNameFor, validPortalSlug } from "@/lib/session-cookie";
import { APP_HOST } from "@/lib/site";
import { describeDevice } from "@/lib/account-emails";
import { markRevoked } from "@/lib/session-revocation";

/**
 * Signed-in sessions ("where you're signed in").
 *
 * Every sign-in issues a session JWT with its own `sid`; startSession()
 * records it with the device and approximate location (from the hosting
 * platform's geo headers — no IP address is stored). A session can be
 * signed out from Profile; signing out of "all other devices" also stamps
 * User.sessionsValidAfter so sign-ins from before per-session ids end too.
 *
 * Enforcement: GET /api/auth/me — read on every page load — rejects a
 * revoked session and clears its cookie, so a signed-out device is signed
 * out on its next page load. When Upstash Redis is configured, the proxy
 * (src/proxy.ts) also rejects revoked sessions on every API call.
 */

const TOUCH_EVERY_MS = 5 * 60 * 1000;

function locationOf(req: NextRequest): string | null {
  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  const parts = [city ? decodeURIComponent(city) : null, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * The portal a sign-in belongs to. On the official host with no portal
 * open, a whitelabel tenant's member signs in to their own institution's
 * portal (as they already land there), so the official site's own sign-in
 * in the same browser is left untouched.
 */
async function portalForSignIn(req: NextRequest, session: SessionPayload | null): Promise<{ slug: string | null; open: boolean }> {
  const current = portalSlugFromHeaders(req.headers);
  if (current || !session?.tenantId) return { slug: current, open: false };
  const bare = (h: string) => h.split(":")[0].toLowerCase().replace(/^www\./, "");
  if (bare(req.headers.get("host") ?? "") !== bare(APP_HOST)) return { slug: null, open: false };
  const tenant = await db.tenant
    .findUnique({ where: { id: session.tenantId }, select: { slug: true, isPlatform: true, status: true } })
    .catch(() => null);
  const slug = tenant && !tenant.isPlatform && tenant.status === "ACTIVE" ? validPortalSlug(tenant.slug) : null;
  return { slug, open: !!slug };
}

/**
 * Sets this site's session cookie and records the session. Use wherever a
 * sign-in completes. Only this site is signed in: the official site and
 * every tenant portal keep separate sign-ins (src/lib/session-cookie.ts).
 */
export async function startSession(req: NextRequest, res: NextResponse, token: string): Promise<void> {
  const s = verifyToken(token);
  const portal = await portalForSignIn(req, s);
  if (portal.open && portal.slug) {
    res.cookies.set(PORTAL_COOKIE_NAME, portal.slug, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  res.cookies.set(sessionCookieNameFor(portal.slug), token, sessionCookieOptions());
  if (!s?.sid) return;
  await db.userSession
    .upsert({
      where: { id: s.sid },
      create: { id: s.sid, userId: s.userId, device: describeDevice(req.headers.get("user-agent")), location: locationOf(req) },
      update: { lastSeenAt: new Date() },
    })
    .catch((e) => console.error("[sessions] record failed:", e));
}

/**
 * Whether a session is still valid (not signed out), refreshing its
 * last-seen time now and then. Fails open on database errors.
 */
export async function checkSession(session: SessionPayload, req?: NextRequest): Promise<boolean> {
  try {
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { sessionsValidAfter: true } });
    if (user?.sessionsValidAfter && session.iat && session.iat * 1000 < user.sessionsValidAfter.getTime() && !session.sid) return false;
    if (!session.sid) return true;
    const row = await db.userSession.findUnique({ where: { id: session.sid } });
    if (!row) {
      // Signed in before session tracking: start tracking it now.
      if (user?.sessionsValidAfter && session.iat && session.iat * 1000 < user.sessionsValidAfter.getTime()) return false;
      await db.userSession
        .create({ data: { id: session.sid, userId: session.userId, device: describeDevice(req?.headers.get("user-agent") ?? null), location: req ? locationOf(req) : null } })
        .catch(() => {});
      return true;
    }
    if (row.revokedAt) return false;
    if (Date.now() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      await db.userSession.update({ where: { id: row.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }
    return true;
  } catch {
    return true;
  }
}

export async function listSessions(userId: string) {
  return db.userSession.findMany({
    where: { userId, revokedAt: null, lastSeenAt: { gt: new Date(Date.now() - 8 * 24 * 3600 * 1000) } },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });
}


export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  const r = await db.userSession.updateMany({ where: { id: sid, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await markRevoked(r.count ? [sid] : []);
  return r.count > 0;
}

/** Signs out every session except `keepSid` (the current one). */
export async function revokeOtherSessions(userId: string, keepSid?: string): Promise<number> {
  const others = await db.userSession.findMany({ where: { userId, revokedAt: null, ...(keepSid ? { id: { not: keepSid } } : {}) }, select: { id: true } });
  await db.userSession.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { revokedAt: new Date() } });
  await db.user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } });
  await markRevoked(others.map((o) => o.id));
  return others.length;
}
