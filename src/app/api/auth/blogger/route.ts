import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { buildAuthUrl, isBloggerLiveMode } from "@/lib/blogger";
import crypto from "crypto";

/**
 * GET /api/auth/blogger
 * Initiates the Blogger "connect your Google account" flow for an already
 * logged-in author. Unlike the ORCID flow (which authenticates/creates a
 * user), this links a Blogger connection to a specific existing EPIP
 * session — identified from the session cookie the browser attaches
 * automatically on this top-level navigation (previously required the
 * session JWT as a `?token=` query param, which leaked it into browser
 * history/Referer headers/server logs; not needed now that sessions are
 * cookie-based). A short-lived httpOnly cookie stashes just the user id
 * plus a CSRF state nonce for the callback to read back.
 *
 * In sandbox mode (no GOOGLE_CLIENT_ID), simulates the OAuth round trip by
 * redirecting straight to the callback, mirroring /api/auth/orcid's
 * simulated-mode pattern.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.redirect(new URL("/?error=blogger_auth_required", req.url));
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/blogger/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const target = isBloggerLiveMode()
    ? buildAuthUrl(redirectUri, state)
    : `${req.nextUrl.origin}/api/auth/blogger/callback?simulated=1&state=${state}`;

  const res = NextResponse.redirect(new URL(target));
  res.cookies.set("blogger_oauth_state", state, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 600, path: "/" });
  res.cookies.set("blogger_oauth_user", session.userId, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
