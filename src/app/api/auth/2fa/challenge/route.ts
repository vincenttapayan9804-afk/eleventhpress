import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPendingTwoFactorToken, signToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { verifyTwoFactorToken, consumeBackupCode } from "@/lib/twofactor";
import { checkRateLimit } from "@/lib/ratelimit";
import { extractRequestIp } from "@/lib/institutions";

/**
 * Second step of login for accounts with twoFactorEnabled. Redeems the
 * pendingToken minted by POST /api/auth/2fa/setup — see its issuance in
 * src/app/api/auth/login/route.ts — against either a live 6-digit TOTP
 * code or a one-time backup code, then issues the real session cookie.
 */
export async function POST(req: NextRequest) {
  const { pendingToken, token } = (await req.json().catch(() => ({}))) as {
    pendingToken?: string;
    token?: string;
  };
  if (!pendingToken || !token) {
    return NextResponse.json({ error: "Missing pending token or verification code" }, { status: 400 });
  }

  const pending = verifyPendingTwoFactorToken(pendingToken);
  if (!pending) {
    return NextResponse.json({ error: "Your sign-in session expired — please sign in again." }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-challenge:${pending.userId}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { id: pending.userId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "Two-factor authentication is not enabled for this account" }, { status: 400 });
  }

  const ip = extractRequestIp(req.headers);
  const userAgent = req.headers.get("user-agent") || null;

  let ok = await verifyTwoFactorToken(token, user.twoFactorSecret);
  let remainingBackupCodes: string | null | undefined;
  if (!ok) {
    remainingBackupCodes = consumeBackupCode(token, user.twoFactorBackupCodes);
    ok = remainingBackupCodes !== null;
  }
  if (!ok) {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN_FAILURE",
        entityType: "USER",
        entityId: user.id,
        metadata: JSON.stringify({ ip, userAgent, reason: "invalid_2fa_code" }),
      },
    }).catch(() => {});
    return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
  }

  if (remainingBackupCodes !== undefined) {
    await db.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: remainingBackupCodes } });
  }

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "USER",
      entityId: user.id,
      metadata: JSON.stringify({ ip, userAgent, via: "2fa" }),
    },
  }).catch(() => {});

  const sessionToken = signToken({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      affiliation: user.affiliation,
      expertise: user.expertise,
      country: user.country,
      orcid: user.orcid,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    },
  });
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  return res;
}
