import { NextRequest, NextResponse } from "next/server";
import { respondToConfirmation } from "@/lib/authorship";

/**
 * POST /api/authorship/respond — a co-author's answer from the emailed
 * link. Body: { token, confirm: boolean, comment? }. The unguessable token
 * is the credential; no sign-in needed.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; confirm?: boolean; comment?: string };
  if (!body.token || typeof body.confirm !== "boolean") {
    return NextResponse.json({ error: "token and confirm are required" }, { status: 400 });
  }
  const result = await respondToConfirmation(body.token, body.confirm, body.comment);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result);
}
