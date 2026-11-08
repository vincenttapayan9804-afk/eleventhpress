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
    select: { id: true, email: true, fullName: true, tenantId: true, passwordHash: true, deletedAt: true },
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
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "Another account already uses that email address." }, { status: 409 });
  }

  if (emailTwoFactorAvailable()) {
    const sent = await sendChangeEmailCode(user, newEmail);
    if (!sent.delivered) {
      return NextResponse.json({ error: "We couldn't send the email just now. Please try again in a minute." }, { status: 502 });
    }
    return NextResponse.json({ mode: "code", sentTo: sent.sentTo });
  }

  return applyEmailChange(user.id, newEmail, false, { mode: "changed" });
}
