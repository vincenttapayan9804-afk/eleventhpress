import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, SESSION_COOKIE_NAME, sessionCookieOptions, type SessionPayload } from "@/lib/auth";
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

/** Sets the session cookie and records the session. Use wherever a sign-in completes. */
export async function startSession(req: NextRequest, res: NextResponse, token: string): Promise<void> {
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  const s = verifyToken(token);
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
