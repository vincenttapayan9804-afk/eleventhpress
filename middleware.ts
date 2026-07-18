import { NextRequest, NextResponse } from "next/server";

/**
 * Single middleware entry point for this app (Next.js only supports one).
 * Currently a no-op pass-through — the security-hardening epic's later
 * phases (CSRF double-submit-cookie check, Upstash-backed rate limiting on
 * auth endpoints) each add one focused block here rather than each phase
 * inventing its own middleware file.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
