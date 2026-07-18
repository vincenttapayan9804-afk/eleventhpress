import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { verifyTwoFactorToken, generateBackupCodes } from "@/lib/twofactor";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Completes enrollment: proves the authenticator app was set up correctly
 * by requiring one real 6-digit code, then flips twoFactorEnabled on and
 * mints backup codes. The backup codes are returned in plaintext exactly
 * once — only their bcrypt hashes are persisted (src/lib/twofactor.ts).
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-confirm:${session.userId}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) {
    return NextResponse.json({ error: "Missing verification code" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { twoFactorSecret: true } });
  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: "No two-factor setup in progress — call /api/auth/2fa/setup first" }, { status: 400 });
  }

  if (!(await verifyTwoFactorToken(token, user.twoFactorSecret))) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  const { plaintext, hashed } = generateBackupCodes();
  await db.user.update({
    where: { id: session.userId },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
  });

  return NextResponse.json({ ok: true, backupCodes: plaintext });
}
