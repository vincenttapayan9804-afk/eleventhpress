import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { emailTwoFactorAvailable, issueEmailCode } from "@/lib/twofactor-email";

/**
 * Starts email-based enrollment (no authenticator app needed): emails a
 * 6-digit code to the account's address. POST /api/auth/2fa/confirm with
 * { method: "email", token } finishes it.
 */
/** Whether emailed codes can be offered here (email delivery configured). */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({ available: emailTwoFactorAvailable() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-email-setup:${session.userId}`, 3, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  if (!emailTwoFactorAvailable()) {
    return NextResponse.json(
      { error: "Email delivery isn't set up on this platform yet, so codes can't be emailed. Use an authenticator app instead." },
      { status: 503 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, fullName: true, tenantId: true, twoFactorEnabled: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled. Disable it before switching method." },
      { status: 400 }
    );
  }

  const sent = await issueEmailCode(user, "setup");
  if (!sent.delivered) {
    return NextResponse.json({ error: "We couldn't send the email just now. Please try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: sent.sentTo });
}
