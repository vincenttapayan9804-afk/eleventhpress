import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordFingerprint, verifyPasswordResetToken, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";
import { isPasswordBreached } from "@/lib/password-breach";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { APP_BASE_URL } from "@/lib/site";

/**
 * GET  /api/auth/reset-password?token=…  — is this reset link still valid?
 *      (so the page can say so before the reader types a new password)
 * POST /api/auth/reset-password { token, password } — sets the new password.
 *
 * A token is valid for 30 minutes and only while the account's password is
 * unchanged, so each link works once. A successful reset also clears any
 * failed-login lockout, confirms the email address (the reader just proved
 * they receive mail there) and emails a "your password was changed"
 * notice. It does not sign the reader in: they sign in with the new
 * password, which keeps two-factor authentication in the loop for accounts
 * that use it.
 */
const INVALID_LINK = "This reset link is invalid or has expired. Request a new one from the sign-in page.";

const ResetSchema = z.object({
  token: z.string().min(1).max(2000),
  password: z.string().max(200),
});

async function userForToken(token: string) {
  const claims = verifyPasswordResetToken(token);
  if (!claims) return null;
  const user = await db.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, fullName: true, passwordHash: true, deletedAt: true, emailVerifiedAt: true, twoFactorEnabled: true },
  });
  if (!user || user.deletedAt || passwordFingerprint(user.passwordHash) !== claims.fp) return null;
  return user;
}

/** "jo***@example.org", so the page can confirm which account without exposing the address. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your account";
  return `${local.slice(0, Math.min(2, local.length))}${"*".repeat(3)}@${domain}`;
}

export async function GET(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`reset-password-check:${ip}`, 30, 900);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const user = token ? await userForToken(token).catch(() => null) : null;
  if (!user) return NextResponse.json({ valid: false, message: INVALID_LINK });
  return NextResponse.json({ valid: true, email: maskEmail(user.email), minLength: MIN_PASSWORD_LENGTH });
}

export async function POST(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`reset-password:${ip}`, 10, 900);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const parsed = await parseBody(req, ResetSchema);
  if (!parsed.ok) return parsed.response;
  const { token, password } = parsed.data;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  try {
    const user = await userForToken(token);
    if (!user) return NextResponse.json({ error: INVALID_LINK, invalidLink: true }, { status: 400 });

    if (await isPasswordBreached(password)) {
      return NextResponse.json(
        { error: "This password has appeared in a known data breach. Please choose a different password." },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
        ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date(), emailVerificationToken: null }),
      },
    });

    await db.auditLog
      .create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET",
          entityType: "USER",
          entityId: user.id,
          metadata: JSON.stringify({ ip, userAgent: req.headers.get("user-agent") || null }),
        },
      })
      .catch(() => {});

    await sendEmail({
      to: user.email,
      subject: "Your password was changed — Eleventh Press",
      html: notificationEmailHtml({
        title: "Your password was changed",
        message:
          "The password for your Eleventh Press account was just changed using a reset link. If this was you, there's nothing else to do. If it wasn't, reset your password again straight away from the sign-in page and contact the editorial office.",
        ctaUrl: `${APP_BASE_URL}/?view=login`,
        ctaLabel: "Sign in",
      }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, twoFactorEnabled: user.twoFactorEnabled });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Your password couldn't be changed right now. Please try again." }, { status: 500 });
  }
}
