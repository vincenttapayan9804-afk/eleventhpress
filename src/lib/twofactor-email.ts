/**
 * Email-based two-factor authentication, for people without an
 * authenticator app: a 6-digit code is emailed at enrollment and at each
 * sign-in. Codes live only as an HMAC on the user row, expire after
 * EMAIL_CODE_TTL_MINUTES and allow EMAIL_CODE_MAX_ATTEMPTS guesses.
 */
import { db } from "./db";
import { sendEmail, notificationEmailHtml, emailLiveMode } from "./email";
import { emailBrandForTenantId, brandName } from "./email-brand";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_MINUTES,
  emailCodeMatches,
  generateEmailCode,
  hashEmailCode,
  maskEmail,
} from "./twofactor-email-code";

export { maskEmail };

/**
 * Email codes need real delivery in production; in development (no Resend
 * key) the code is written to the server console instead so the flow can
 * still be exercised end to end.
 */
export function emailTwoFactorAvailable(): boolean {
  return emailLiveMode() || process.env.NODE_ENV !== "production";
}

export type EmailCodePurpose = "setup" | "signin";

export interface IssueEmailCodeResult {
  delivered: boolean;
  sentTo: string;
}

/** Generates a fresh code (replacing any earlier one) and emails it. */
export async function issueEmailCode(
  user: { id: string; email: string; fullName: string; tenantId: string | null },
  purpose: EmailCodePurpose
): Promise<IssueEmailCodeResult> {
  const code = generateEmailCode();
  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorEmailCodeHash: hashEmailCode(user.id, code),
      twoFactorEmailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
      twoFactorEmailCodeAttempts: 0,
    },
  });

  const brand = await emailBrandForTenantId(user.tenantId);
  const name = brandName(brand);
  const action = purpose === "setup" ? "turn on two-factor sign-in" : "finish signing in";
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const result = await sendEmail({
    to: user.email,
    subject: `${spaced} is your ${name} verification code`,
    html: notificationEmailHtml({
      title: "Your verification code",
      message: `Hi ${escapeHtml(user.fullName.split(" ")[0] || user.fullName)}, use this code to ${action}:
        <div style="margin:18px 0;font-family:monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#1a1a1a;">${spaced}</div>
        It expires in ${EMAIL_CODE_TTL_MINUTES} minutes. If you didn't try to sign in, change your password — someone may know it.`,
      brand,
    }),
    text: `Your ${name} verification code is ${code}. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes. If you didn't try to sign in, change your password.`,
  });
  if (result.mode === "simulation" && process.env.NODE_ENV !== "production") {
    console.info(`[2fa-email] development code for ${user.email}: ${code}`);
  }
  // In production a "simulation" send reached nobody, so it doesn't count.
  const delivered = result.ok && (result.mode === "live" || process.env.NODE_ENV !== "production");
  return { delivered, sentTo: maskEmail(user.email) };
}

export type RedeemResult = "ok" | "invalid" | "expired" | "too_many_attempts";

/** Checks a code; single use on success, counts the attempt on failure. */
export async function redeemEmailCode(userId: string, code: string): Promise<RedeemResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorEmailCodeHash: true, twoFactorEmailCodeExpiresAt: true, twoFactorEmailCodeAttempts: true },
  });
  if (!user?.twoFactorEmailCodeHash || !user.twoFactorEmailCodeExpiresAt) return "invalid";
  if (user.twoFactorEmailCodeExpiresAt.getTime() < Date.now()) return "expired";
  if (user.twoFactorEmailCodeAttempts >= EMAIL_CODE_MAX_ATTEMPTS) return "too_many_attempts";

  if (emailCodeMatches(userId, code, user.twoFactorEmailCodeHash)) {
    await db.user.update({
      where: { id: userId },
      data: { twoFactorEmailCodeHash: null, twoFactorEmailCodeExpiresAt: null, twoFactorEmailCodeAttempts: 0 },
    });
    return "ok";
  }
  await db.user.update({ where: { id: userId }, data: { twoFactorEmailCodeAttempts: { increment: 1 } } });
  return "invalid";
}

export function redeemErrorMessage(result: RedeemResult): string {
  switch (result) {
    case "expired":
      return "That code has expired — send a new one.";
    case "too_many_attempts":
      return "Too many incorrect attempts — send a new code.";
    default:
      return "Invalid verification code";
  }
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
