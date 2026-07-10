import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, hashPassword } from "@/lib/auth";
import crypto from "crypto";

/**
 * GET /api/auth/orcid
 * Redirects the user to ORCID's OAuth 2.0 authorization endpoint.
 * The user grants the platform permission to read their ORCID record.
 *
 * Scopes requested:
 *   - /authenticate  (read ORCID iD + name)
 *   - /read-limited  (read employment, education, works — premium member API)
 *   - /activities/update (write works back on publication — auto-update)
 *
 * In sandbox mode (no ORCID_CLIENT_ID), this endpoint simulates the OAuth
 * flow by creating/linking a demo ORCID user directly.
 */

const ORCID_AUTH_URL = "https://orcid.org/oauth/authorize";
const ORCID_SANDBOX_AUTH_URL = "https://sandbox.orcid.org/oauth/authorize";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  const redirectUri = `${req.nextUrl.origin}/api/auth/orcid/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie for CSRF protection
  const target = clientId
    ? `${process.env.ORCID_ENV === "production" ? ORCID_AUTH_URL : ORCID_SANDBOX_AUTH_URL}?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `scope=/authenticate /read-limited /activities/update&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`
    : `${req.nextUrl.origin}/api/auth/orcid/callback?simulated=1&state=${state}`;

  const res = NextResponse.redirect(new URL(target));
  res.cookies.set("orcid_oauth_state", state, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
