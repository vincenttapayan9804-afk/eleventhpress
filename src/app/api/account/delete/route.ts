import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders, verifyPassword, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { anonymizeUserAccount } from "@/lib/account-privacy";

/**
 * POST /api/account/delete
 * GDPR Art. 17 / CCPA right-to-erasure — self-service, irreversible.
 * Requires re-entering the current password (same posture as disabling
 * 2FA) since a stolen session cookie alone should not be enough to erase
 * an account. See src/lib/account-privacy.ts for why this anonymizes the
 * row in place rather than deleting it.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`account-delete:${session.userId}`, 3, 300);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "Password confirmation is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true, role: true, deletedAt: true },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  if (user.deletedAt) {
    return NextResponse.json({ error: "Account already deleted" }, { status: 409 });
  }

  // The platform must always keep at least one super admin able to sign
  // in — otherwise a sole super admin deleting their own account would
  // permanently lock everyone out of platform administration.
  if (user.role === "SUPER_ADMIN") {
    const otherAdmins = await db.user.count({
      where: { role: "SUPER_ADMIN", id: { not: session.userId }, deletedAt: null },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "You're the only super admin — promote another account first." },
        { status: 409 }
      );
    }
  }

  await anonymizeUserAccount(session.userId);

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ACCOUNT_DELETED",
      entityType: "USER",
      entityId: session.userId,
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
