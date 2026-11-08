/**
 * One-time password reset triggered from the Vercel dashboard — the backup
 * for when the emailed "Forgot password" link can't arrive (for example
 * before email delivery is configured, or if the account's mailbox is
 * unreachable). Works for any account, including the administrator.
 *
 * How to use it:
 *   1. In Vercel → Project → Settings → Environment Variables (Production),
 *      add PASSWORD_RESET_EMAIL (the account's sign-in email) and
 *      PASSWORD_RESET_NEW_PASSWORD (the new password, at least 8
 *      characters). Optionally PASSWORD_RESET_DISABLE_2FA=true if the
 *      authenticator app was also lost.
 *   2. Redeploy. This script runs during the build and sets the password.
 *   3. Sign in with the new password, then DELETE those variables.
 *
 * It applies each request once: a keyed fingerprint of the request is
 * recorded in the audit log, so later builds won't reset the password
 * again (for example after you change it from the site) while the
 * variables are still set. Never prints the password. Always exits 0 so it
 * can't break a deploy.
 */
import { createHmac } from "crypto";
import { db } from "../src/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth";

const ACTION = "PASSWORD_RESET_VIA_DEPLOY";

async function main() {
  const email = process.env.PASSWORD_RESET_EMAIL?.trim();
  const password = process.env.PASSWORD_RESET_NEW_PASSWORD ?? "";
  const disable2fa = process.env.PASSWORD_RESET_DISABLE_2FA === "true";
  if (!email && !password) return; // nothing requested: the normal case
  if (!email || !password) {
    console.warn("[password-reset] set both PASSWORD_RESET_EMAIL and PASSWORD_RESET_NEW_PASSWORD; skipping.");
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.warn(`[password-reset] the new password must be at least ${MIN_PASSWORD_LENGTH} characters; skipping.`);
    return;
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.warn("[password-reset] SESSION_SECRET is not set; skipping.");
    return;
  }

  const user =
    (await db.user.findUnique({ where: { email } })) ??
    (await db.user.findUnique({ where: { email: email.toLowerCase() } }));
  if (!user || user.deletedAt) {
    console.warn(`[password-reset] no active account for ${email}; skipping.`);
    return;
  }

  const fingerprint = createHmac("sha256", secret).update(`${user.id}\n${password}\n${disable2fa}`).digest("hex");
  const alreadyApplied = await db.auditLog.findFirst({
    where: { action: ACTION, entityId: user.id, metadata: { contains: fingerprint } },
    select: { id: true },
  });
  if (alreadyApplied) {
    console.log(`[password-reset] this reset for ${email} was already applied; remove the PASSWORD_RESET_* variables.`);
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      failedLoginCount: 0,
      lockedUntil: null,
      ...(disable2fa
        ? { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null, twoFactorMethod: "TOTP", twoFactorEmailCodeHash: null, twoFactorEmailCodeExpiresAt: null }
        : {}),
    },
  });
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: ACTION,
      entityType: "USER",
      entityId: user.id,
      metadata: JSON.stringify({ fingerprint, disabledTwoFactor: disable2fa }),
    },
  });
  console.log(
    `[password-reset] password reset for ${email}${disable2fa ? " (two-factor turned off)" : ""}. Sign in, then delete the PASSWORD_RESET_* variables.`
  );
}

main()
  .catch((e) => console.error("[password-reset] failed:", e instanceof Error ? e.message : e))
  .finally(() => db.$disconnect().catch(() => {}));
