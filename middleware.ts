import { NextRequest, NextResponse } from "next/server";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken } from "@/lib/csrf";

/**
 * Single middleware entry point for this app (Next.js only supports one).
 * Later security-epic phases (Upstash-backed rate limiting on auth
 * endpoints) add their own focused block here rather than inventing a
 * second middleware file.
 */

// Routes that authenticate via something other than the session cookie
// (HMAC/bearer-secret webhook signature, a single-use presign token in the
// URL) and so aren't a CSRF target — a forged cross-site request can't
// produce a valid signature or secret either way, so subjecting them to
// this check would only break legitimate server-to-server callers for no
// security gain. login/register/2fa-challenge are exempt too: none of them
// run with a real session cookie yet — login and register precede having
// one at all, and the 2FA challenge step authenticates via its own
// short-lived pending token (src/lib/auth.ts) rather than the session
// cookie.
const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/billing/webhook/",
  "/api/cron/",
  "/api/storage/upload-local/",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/2fa/challenge",
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Ensure every visitor has a CSRF cookie to double-submit against.
  if (!req.cookies.get(CSRF_COOKIE_NAME)) {
    res.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  const isMutating = MUTATING_METHODS.has(req.method);
  const isExempt = CSRF_EXEMPT_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isMutating && !isExempt) {
    const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = req.headers.get(CSRF_HEADER_NAME);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json({ error: "CSRF token missing or invalid" }, { status: 403 });
    }
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
