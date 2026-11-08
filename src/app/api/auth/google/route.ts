import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { googleConfigured, googleRedirectUri } from "@/lib/google-oauth";
import { relyingParty } from "@/lib/passkeys";

/** GET — starts "Sign in with Google": redirects to Google's consent screen with a CSRF state. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login?error=google_unavailable", req.url));
  const { origin } = relyingParty(req);
  const state = crypto.randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
