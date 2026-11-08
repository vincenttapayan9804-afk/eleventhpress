/**
 * Changing an account's sign-in email (Profile -> Security).
 *
 * With email delivery configured, a 6-digit code goes to the NEW address and
 * the switch happens only once it is entered (10-minute expiry, 5 attempts).
 * Without email delivery (no Resend key yet) the change applies after the
 * password check and the new address typed twice; the address is then marked
 * unverified so it can be confirmed once email is set up.
 */
import { NextResponse } from "next/server";
import { db } from "./db";
import { signToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "./auth";
import { sendEmail, notificationEmailHtml } from "./email";
import { emailBrandForTenantId, brandName } from "./email-brand";
import { workspaceOf } from "./workspace";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_MINUTES,
  emailCodeMatches,
  generateEmailCode,
  hashEmailCode,
  maskEmail,
} from "./twofactor-email-code";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Bound to both the account and the address, so a code can't confirm a different address. */
function codeKey(userId: string, newEmail: string): string {
  return `${userId}:change-email:${newEmail}`;
}

export async function sendChangeEmailCode(
  user: { id: string; fullName: string; tenantId: string | null },
  newEmail: string
): Promise<{ delivered: boolean; sentTo: string }> {
  const code = generateEmailCode();
  await db.user.update({
    where: { id: user.id },
    data: {
      pendingEmail: newEmail,
      pendingEmailCodeHash: hashEmailCode(codeKey(user.id, newEmail), code),
      pendingEmailExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
      pendingEmailAttempts: 0,
    },
  });
  const brand = await emailBrandForTenantId(user.tenantId);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const result = await sendEmail({
    to: newEmail,
    subject: `${spaced} confirms your new ${brandName(brand)} sign-in email`,
    html: notificationEmailHtml({
      title: "Confirm your new sign-in email",
      message: `Enter this code to make this address the sign-in email for your account:
        <div style="margin:18px 0;font-family:monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#1a1a1a;">${spaced}</div>
        It expires in ${EMAIL_CODE_TTL_MINUTES} minutes. If you didn't ask for this, ignore this email — nothing changes.`,
      brand,
    }),
    text: `Your code to confirm your new sign-in email is ${code}. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
  });
  if (result.mode === "simulation" && process.env.NODE_ENV !== "production") {
    console.info(`[change-email] development code for ${newEmail}: ${code}`);
  }
  const delivered = result.ok && (result.mode === "live" || process.env.NODE_ENV !== "production");
  return { delivered, sentTo: maskEmail(newEmail) };
}

export type PendingCheck = { ok: true; newEmail: string } | { ok: false; error: string };

export async function checkChangeEmailCode(userId: string, code: string): Promise<PendingCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { pendingEmail: true, pendingEmailCodeHash: true, pendingEmailExpiresAt: true, pendingEmailAttempts: true },
  });
  if (!user?.pendingEmail || !user.pendingEmailCodeHash || !user.pendingEmailExpiresAt) {
    return { ok: false, error: "There's no email change in progress — start again." };
  }
  if (user.pendingEmailExpiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code has expired — send a new one." };
  }
  if (user.pendingEmailAttempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts — send a new code." };
  }
  if (!emailCodeMatches(codeKey(userId, user.pendingEmail), code, user.pendingEmailCodeHash)) {
    await db.user.update({ where: { id: userId }, data: { pendingEmailAttempts: { increment: 1 } } });
    return { ok: false, error: "Invalid verification code" };
  }
  return { ok: true, newEmail: user.pendingEmail };
}

export class EmailTakenError extends Error {}

/**
 * Switches the sign-in email, records it, tells the old address, and
 * returns a response carrying a fresh session cookie (the session token
 * embeds the email).
 */
export async function applyEmailChange(
  userId: string,
  newEmail: string,
  verified: boolean,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const before = await db.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true, tenantId: true } });
  if (!before) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  let user;
  try {
    user = await db.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerifiedAt: verified ? new Date() : null,
        emailVerificationToken: null,
        pendingEmail: null,
        pendingEmailCodeHash: null,
        pendingEmailExpiresAt: null,
        pendingEmailAttempts: 0,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Another account already uses that email address." }, { status: 409 });
    }
    throw err;
  }

  await db.auditLog
    .create({
      data: {
        userId,
        action: "EMAIL_CHANGED",
        entityType: "USER",
        entityId: userId,
        metadata: JSON.stringify({ from: before.email, to: newEmail, verified }),
      },
    })
    .catch(() => {});

  // Heads-up to the old address (fails open — it may not be a real inbox).
  const brand = await emailBrandForTenantId(before.tenantId);
  await sendEmail({
    to: before.email,
    subject: `Your ${brandName(brand)} sign-in email was changed`,
    html: notificationEmailHtml({
      title: "Your sign-in email was changed",
      message: `The sign-in email for your account was changed to ${maskEmail(newEmail)}. If this wasn't you, reset your password and contact the platform administrator straight away.`,
      brand,
    }),
  }).catch(() => {});

  const res = NextResponse.json({
    ok: true,
    ...extra,
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
  res.cookies.set(
    SESSION_COOKIE_NAME,
    signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    }),
    sessionCookieOptions()
  );
  return res;
}
