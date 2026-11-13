import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromHeaders, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";
import { emailTwoFactorAvailable } from "@/lib/twofactor-email";
import { applyEmailChange, normalizeEmail, sendChangeEmailCode } from "@/lib/change-email";

const StartSchema = z.object({
  newEmail: z.string().trim().min(3).max(254).email("Enter a valid email address"),
  confirmEmail: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
  // Super admin only: take the address over from the account that holds it.
  releaseFromOtherAccount: z.boolean().optional(),
});

/**
 * POST /api/auth/change-email/start { newEmail, confirmEmail, password }
 * Re-checks the password, then either emails a confirmation code to the new
 * address ({ mode: "code" }) or — when email delivery isn't configured —
 * switches straight away ({ mode: "changed" }). See src/lib/change-email.ts.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const rl = await checkRateLimit(`change-email:${session.userId}`, 5, 900);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const parsed = await parseBody(req, StartSchema);
  if (!parsed.ok) return parsed.response;
  const newEmail = normalizeEmail(parsed.data.newEmail);
  if (normalizeEmail(parsed.data.confirmEmail) !== newEmail) {
    return NextResponse.json({ error: "The two email addresses don't match." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, fullName: true, tenantId: true, passwordHash: true, deletedAt: true, role: true },
  });
  if (!user || user.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (!verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Your password is incorrect" }, { status: 400 });
  }
  if (newEmail === normalizeEmail(user.email)) {
    return NextResponse.json({ error: "That's already your sign-in email." }, { status: 400 });
  }
  const taken = await db.user.findFirst({
    where: { email: { equals: newEmail, mode: "insensitive" }, NOT: { id: user.id } },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      tenant: { select: { name: true } },
      _count: { select: { submissions: true } },
    },
  });
  if (taken) {
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    if (isSuperAdmin && parsed.data.releaseFromOtherAccount) {
      await releaseEmail(taken.id, taken.email, user.id);
    } else {
      return NextResponse.json(
        {
          error: "Another account already uses that email address.",
          code: "EMAIL_TAKEN",
          // Only the platform owner sees who holds it — anyone else learns
          // nothing beyond what registration would already reveal.
          ...(isSuperAdmin
            ? {
                holder: {
                  fullName: taken.fullName,
                  role: taken.role,
                  tenantName: taken.tenant?.name ?? null,
                  createdAt: taken.createdAt.toISOString(),
                  submissions: taken._count.submissions,
                },
              }
            : {}),
        },
        { status: 409 }
      );
    }
  }

  if (emailTwoFactorAvailable()) {
    const sent = await sendChangeEmailCode(user, newEmail);
    if (!sent.delivered) {
      return NextResponse.json({ error: "We couldn't send the email just now. Please try again in a minute." }, { status: 502 });
    }
    return NextResponse.json({ mode: "code", sentTo: sent.sentTo });
  }

  return applyEmailChange(user.id, newEmail, false, { mode: "changed" }, req.headers);
}

/**
 * Moves the other account onto a placeholder address so this one is free.
 * Nothing else about that account changes (its work, role and history stay);
 * it simply can no longer sign in with the address. The audit log keeps the
 * original address so it can be restored by hand if needed.
 */
async function releaseEmail(holderId: string, heldEmail: string, byUserId: string) {
  const placeholder = `released-${holderId.slice(-8)}-${Date.now().toString(36)}@released.eleventhpress.invalid`;
  await db.user.update({
    where: { id: holderId },
    data: { email: placeholder, emailVerifiedAt: null, emailVerificationToken: null },
  });
  await db.auditLog
    .create({
      data: {
        userId: byUserId,
        action: "EMAIL_RELEASED",
        entityType: "USER",
        entityId: holderId,
        metadata: JSON.stringify({ from: heldEmail, to: placeholder }),
      },
    })
    .catch(() => {});
}
