import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clears the httpOnly session cookie. Nothing to invalidate server-side
 * (sessions are stateless JWTs) — this exists purely because client JS
 * can't clear an httpOnly cookie itself.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
