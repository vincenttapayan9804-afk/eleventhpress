import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Turning off 2FA is a security-downgrade action, so — same posture as
 * changing a password — it requires re-proving the account password even
 * though the request already carries a valid session cookie. A stolen
 * session cookie alone is not enough to strip an account's second factor.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-disable:${session.userId}`, 5, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "Password confirmation is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null },
  });

  return NextResponse.json({ ok: true });
}
