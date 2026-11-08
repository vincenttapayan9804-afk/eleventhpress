import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";
import { applyEmailChange, checkChangeEmailCode } from "@/lib/change-email";

const ConfirmSchema = z.object({ code: z.string().min(1).max(20) });

/** POST /api/auth/change-email/confirm { code } — finishes the change once the new inbox is proven. */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const rl = await checkRateLimit(`change-email-confirm:${session.userId}`, 10, 300);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const parsed = await parseBody(req, ConfirmSchema);
  if (!parsed.ok) return parsed.response;

  const check = await checkChangeEmailCode(session.userId, parsed.data.code);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  return applyEmailChange(session.userId, check.newEmail, true);
}
