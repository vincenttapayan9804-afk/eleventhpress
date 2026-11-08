import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPendingTwoFactorToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";
import { issueEmailCode } from "@/lib/twofactor-email";

const ResendSchema = z.object({ pendingToken: z.string().min(1).max(2000) });

/** Sends a new sign-in code to an account using email two-factor. */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, ResendSchema);
  if (!parsed.ok) return parsed.response;

  const pending = verifyPendingTwoFactorToken(parsed.data.pendingToken);
  if (!pending) {
    return NextResponse.json({ error: "Your sign-in session expired — please sign in again." }, { status: 401 });
  }

  const rl = await checkRateLimit(`2fa-email-resend:${pending.userId}`, 3, 120);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { id: pending.userId },
    select: { id: true, email: true, fullName: true, tenantId: true, twoFactorEnabled: true, twoFactorMethod: true },
  });
  if (!user?.twoFactorEnabled || user.twoFactorMethod !== "EMAIL") {
    return NextResponse.json({ error: "This account doesn't use emailed codes." }, { status: 400 });
  }

  const sent = await issueEmailCode(user, "signin");
  if (!sent.delivered) {
    return NextResponse.json({ error: "We couldn't send the email just now. Use a backup code or try again shortly." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: sent.sentTo });
}
