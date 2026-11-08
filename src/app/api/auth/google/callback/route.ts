import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { googleConfigured, googleRedirectUri } from "@/lib/google-oauth";
import { relyingParty } from "@/lib/passkeys";
import { startSession } from "@/lib/user-sessions";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { noteSignIn } from "@/lib/account-emails";
import { extractRequestIp } from "@/lib/institutions";
import { isLocked } from "@/lib/account-lockout";

/**
 * GET — Google's redirect back. Verifies state, exchanges the code, and
 * signs in the account with that (Google-verified) email, creating an
 * author account if there isn't one. Accounts with two-step sign-in must
 * keep using their password or a passkey, so Google never bypasses it.
 */
export async function GET(req: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
    res.cookies.set("google_oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };
  if (!googleConfigured()) return fail("google_unavailable");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || !expected || state.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return fail("google_state");
  }

  const { origin } = relyingParty(req);
  let profile: { email?: string; email_verified?: boolean; name?: string; picture?: string };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(origin),
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !tokens.access_token) return fail("google_token");
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    profile = await infoRes.json();
  } catch {
    return fail("google_unreachable");
  }
  const email = (profile.email || "").trim().toLowerCase();
  if (!email || !profile.email_verified) return fail("google_unverified");

  let user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (user?.deletedAt) return fail("account_closed");
  if (user && isLocked(user.lockedUntil)) return fail("account_locked");
  if (user?.twoFactorEnabled) return fail("google_2fa");
  if (!user) {
    const tenant = await resolveTenantFromHeaders(req.headers);
    user = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword(crypto.randomUUID()),
        fullName: (profile.name || email.split("@")[0]).slice(0, 120),
        avatarUrl: profile.picture || null,
        role: "AUTHOR",
        emailVerifiedAt: new Date(),
        tenantId: tenant?.id ?? null,
      },
    });
  } else if (!user.emailVerifiedAt) {
    user = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  const ip = extractRequestIp(req.headers);
  const userAgent = req.headers.get("user-agent");
  await db.auditLog
    .create({ data: { userId: user.id, action: "LOGIN_SUCCESS", entityType: "USER", entityId: user.id, metadata: JSON.stringify({ ip, userAgent, method: "google" }) } })
    .catch(() => {});
  const token = signToken({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName, ...(user.tenantId ? { tenantId: user.tenantId } : {}) });
  const res = NextResponse.redirect(new URL("/?view=dashboard", req.url));
  res.cookies.set("google_oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
  await startSession(req, res, token);
  await noteSignIn(req, res, user, { ip, userAgent });
  return res;
}
