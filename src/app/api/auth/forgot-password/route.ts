import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { signPasswordResetToken, PASSWORD_RESET_TTL_LABEL } from "@/lib/auth";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { APP_BASE_URL } from "@/lib/site";

/**
 * POST /api/auth/forgot-password — "Forgot password?" for every kind of
 * account (reader, author, reviewer, editor, admin).
 *
 * Emails a link to /reset-password carrying a signed token that is valid
 * for 30 minutes and only until the password changes (see
 * signPasswordResetToken in src/lib/auth.ts).
 *
 * The response is identical whether or not the email belongs to an
 * account, so this can't be used to find out who has one. Rate-limited per
 * IP and per address so it can't be used to flood someone's inbox.
 */
const ForgotSchema = z.object({ email: z.string().trim().min(1).max(254) });

const GENERIC_RESPONSE = {
  ok: true,
  message: "If an account exists for that email, a password reset link is on its way.",
};

export async function POST(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`forgot-password:${ip}`, 5, 900);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const parsed = await parseBody(req, ForgotSchema);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email;

  const perAddress = await checkRateLimit(`forgot-password-email:${email.toLowerCase()}`, 3, 3600);
  if (!perAddress.ok) return NextResponse.json({ error: perAddress.message }, { status: 429 });

  try {
    const select = { id: true, email: true, fullName: true, passwordHash: true, deletedAt: true } as const;
    const user =
      (await db.user.findUnique({ where: { email }, select })) ??
      (email !== email.toLowerCase() ? await db.user.findUnique({ where: { email: email.toLowerCase() }, select }) : null);

    if (user && !user.deletedAt) {
      const token = signPasswordResetToken(user.id, user.passwordHash);
      const link = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const result = await sendEmail({
        to: user.email,
        subject: "Reset your password — Eleventh Press",
        html: notificationEmailHtml({
          title: "Reset your password",
          message: `Hi ${escapeHtml(user.fullName)}, we received a request to reset the password for your Eleventh Press account. The link below works once and expires in ${PASSWORD_RESET_TTL_LABEL}. If you didn't ask for this, you can ignore this email — your password won't change.`,
          ctaUrl: link,
          ctaLabel: "Choose a new password",
        }),
        text: `Reset your Eleventh Press password (link expires in ${PASSWORD_RESET_TTL_LABEL}): ${link}\n\nIf you didn't ask for this, ignore this email.`,
      });
      await db.auditLog
        .create({
          data: {
            userId: user.id,
            action: "PASSWORD_RESET_REQUESTED",
            entityType: "USER",
            entityId: user.id,
            metadata: JSON.stringify({ ip, delivered: result.ok, mode: result.mode }),
          },
        })
        .catch(() => {});
    }
  } catch (e) {
    // Logged only: the reader always sees the same response.
    console.error("[forgot-password]", e);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
