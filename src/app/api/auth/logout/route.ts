import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { revokeSession } from "@/lib/user-sessions";

/**
 * POST /api/auth/logout
 * Clears the httpOnly session cookie and ends this sign-in in the
 * "where you're signed in" list (src/lib/user-sessions.ts), so the token
 * can't be reused even if it was copied.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (session?.sid) await revokeSession(session.userId, session.sid).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
