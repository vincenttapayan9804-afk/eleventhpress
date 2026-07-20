import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * GET /api/experts/[id]/questions
 *
 * Public — only ever returns answered AND isPublic questions, the same
 * "only ever show a real, completed answer" honesty bar as every other
 * public read route in this codebase. An expert's pending or
 * privately-answered questions never appear here (see the inbox route
 * for the expert's own view of those).
 *
 * POST /api/experts/[id]/questions
 * Body: { question }
 *
 * Any logged-in reader can ask a question — no anonymous questions, same
 * accountability bar as follow/reviews. Rate-limited since this writes to
 * the database on every call.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const questions = await db.expertQuestion.findMany({
    where: { expertId: id, isPublic: true, answeredAt: { not: null } },
    orderBy: { answeredAt: "desc" },
    select: { id: true, question: true, answer: true, answeredAt: true },
  });
  return NextResponse.json({ items: questions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`ask-expert:${session.userId}`, 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const { id: expertId } = await params;
  if (expertId === session.userId) {
    return NextResponse.json({ error: "Cannot ask yourself a question" }, { status: 400 });
  }

  const expert = await db.user.findUnique({ where: { id: expertId }, select: { role: true } });
  if (!expert || expert.role !== "EXPERT") {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  const { question } = (await req.json()) as { question?: string };
  const trimmed = (question || "").trim();
  if (!trimmed || trimmed.length > 1000) {
    return NextResponse.json({ error: "question is required (max 1000 characters)" }, { status: 400 });
  }

  const created = await db.expertQuestion.create({
    data: { expertId, askedById: session.userId, question: trimmed },
  });

  return NextResponse.json({ id: created.id });
}
