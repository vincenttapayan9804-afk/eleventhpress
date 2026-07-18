import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { generateTwoFactorSecret, generateTwoFactorQrCode } from "@/lib/twofactor";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Starts (or restarts) enrollment: generates a fresh TOTP secret, stores it
 * unconfirmed (twoFactorEnabled stays false until POST /confirm verifies a
 * real code from the authenticator app), and returns a scannable QR code
 * plus the manual-entry key.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-setup:${session.userId}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true, twoFactorEnabled: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled. Disable it before setting up a new device." },
      { status: 400 }
    );
  }

  const secret = generateTwoFactorSecret();
  await db.user.update({ where: { id: session.userId }, data: { twoFactorSecret: secret } });
  const qrCode = await generateTwoFactorQrCode(user.email, secret);

  return NextResponse.json({ secret, qrCode });
}
