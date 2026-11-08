import { workspaceOf } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { noteSignIn } from "@/lib/account-emails";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPendingTwoFactorToken, signToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { verifyTwoFactorToken, consumeBackupCode } from "@/lib/twofactor";
import { checkRateLimit } from "@/lib/ratelimit";
import { extractRequestIp } from "@/lib/institutions";
import { parseBody } from "@/lib/validate";
import { redeemEmailCode } from "@/lib/twofactor-email";

const ChallengeSchema = z.object({
  pendingToken: z.string().min(1).max(2000),
  // Long enough for either a 6-digit TOTP code or a "XXXXX-XXXXX"-style
  // backup code (see src/lib/twofactor.ts) with room to spare.
  token: z.string().min(1).max(40),
});

/**
 * Second step of login for accounts with twoFactorEnabled. Redeems the
 * pendingToken minted at login (src/app/api/auth/login/route.ts) against a
 * live 6-digit TOTP code, the code emailed at login (method "EMAIL"), or a
 * one-time backup code, then issues the real session cookie.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, ChallengeSchema);
  if (!parsed.ok) return parsed.response;
  const { pendingToken, token } = parsed.data;

  const pending = verifyPendingTwoFactorToken(pendingToken);
  if (!pending) {
    return NextResponse.json({ error: "Your sign-in session expired — please sign in again." }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-challenge:${pending.userId}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { id: pending.userId } });
  const usesEmail = user?.twoFactorMethod === "EMAIL";
  if (!user || !user.twoFactorEnabled || (!usesEmail && !user.twoFactorSecret)) {
    return NextResponse.json({ error: "Two-factor authentication is not enabled for this account" }, { status: 400 });
  }

  const ip = extractRequestIp(req.headers);
  const userAgent = req.headers.get("user-agent") || null;

  const trimmed = token.trim();
  const looksLikeOtp = /^\d{6}$/.test(trimmed.replace(/\s+/g, ""));
  let ok = false;
  let emailCodeExpired = false;
  if (usesEmail) {
    if (looksLikeOtp) {
      const result = await redeemEmailCode(user.id, trimmed);
      ok = result === "ok";
      emailCodeExpired = result === "expired" || result === "too_many_attempts";
    }
  } else {
    ok = await verifyTwoFactorToken(trimmed, user.twoFactorSecret!);
  }
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
    return NextResponse.json(
      { error: emailCodeExpired ? "That code has expired or was tried too many times — send a new one." : "Invalid verification code" },
      { status: 401 }
    );
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

  const sessionToken = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    ...(user.tenantId ? { tenantId: user.tenantId } : {}),
  });
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
      tenantId: user.tenantId ?? null,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      emailVerifiedAt: user.emailVerifiedAt,
      workspace: await workspaceOf(user.tenantId),
    },
  });
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  // Email-code users already got an email for this sign-in.
  await noteSignIn(req, res, user, { ip, userAgent, alreadyEmailed: user.twoFactorMethod === "EMAIL" });
  return res;
}
