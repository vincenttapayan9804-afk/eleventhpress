import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateEmailVerificationToken } from "@/lib/email-verification";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { APP_BASE_URL } from "@/lib/site";

/**
 * POST /api/auth/resend-verification
 * Re-sends the signed-in user's own verification link, generating a new
 * token each time (the old one, if any, stops working). Rate-limited
 * per-account rather than per-IP — this is only ever reachable with a
 * valid session, so there's a stable, meaningful key to limit on.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`resend-verification:${session.userId}`, 3, 600);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, fullName: true, emailVerifiedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: "Your email is already verified" }, { status: 400 });
  }

  const emailVerificationToken = generateEmailVerificationToken();
  await db.user.update({ where: { id: session.userId }, data: { emailVerificationToken } });

  const result = await sendEmail({
    to: user.email,
    subject: "Verify your email — Eleventh Press",
    html: notificationEmailHtml({
      title: "Verify your email",
      message: `Hi ${user.fullName}, confirm this is really your email address to finish securing your account.`,
      ctaUrl: `${APP_BASE_URL}/api/auth/verify-email?token=${emailVerificationToken}`,
      ctaLabel: "Verify email",
    }),
  });

  return NextResponse.json({ sent: result.ok });
}
