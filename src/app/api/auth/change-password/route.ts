import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromHeaders, hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";
import { isPasswordBreached } from "@/lib/password-breach";
import { sendSecurityEmail } from "@/lib/account-emails";
import { revokeOtherSessions } from "@/lib/user-sessions";

const ChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
});

/**
 * POST /api/auth/change-password { currentPassword, newPassword }
 * Signed-in password change. Used by the first-sign-in step for accounts an
 * administrator created with a temporary password (User.mustChangePassword),
 * and available to any signed-in account.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const rl = await checkRateLimit(`change-password:${session.userId}`, 10, 900);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const parsed = await parseBody(req, ChangeSchema);
  if (!parsed.ok) return parsed.response;
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, fullName: true, tenantId: true, passwordHash: true, deletedAt: true, mustChangePassword: true },
  });
  if (!user || user.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Your current password is incorrect" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "Choose a password different from the temporary one" }, { status: 400 });
  }
  if (await isPasswordBreached(newPassword)) {
    return NextResponse.json(
      { error: "This password has appeared in a known data breach. Please choose a different password." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
  });
  await db.auditLog
    .create({
      data: { userId: user.id, action: "PASSWORD_CHANGED", entityType: "USER", entityId: user.id },
    })
    .catch(() => {});
  // A first-sign-in swap of an admin-issued temporary password isn't news.
  if (!user.mustChangePassword) {
    await sendSecurityEmail(user, { kind: "password_changed", via: "profile" });
    // A new password ends every other sign-in (src/lib/user-sessions.ts).
    await revokeOtherSessions(session.userId, session.sid).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
