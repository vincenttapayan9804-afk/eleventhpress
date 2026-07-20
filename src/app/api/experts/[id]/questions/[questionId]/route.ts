import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * POST /api/experts/[id]/questions/[questionId]
 * Body: { answer, isPublic }
 *
 * Only the expert who received the question (or SUPER_ADMIN) may answer
 * it. isPublic defaults to true but the expert can set it false to answer
 * privately — the public GET /api/experts/[id]/questions route never
 * returns a question unless both answered AND isPublic are true.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: expertId, questionId } = await params;
  if (session.userId !== expertId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const question = await db.expertQuestion.findUnique({ where: { id: questionId } });
  if (!question || question.expertId !== expertId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const { answer, isPublic } = (await req.json()) as { answer?: string; isPublic?: boolean };
  const trimmed = (answer || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "answer is required" }, { status: 400 });
  }

  const updated = await db.expertQuestion.update({
    where: { id: questionId },
    data: { answer: trimmed, answeredAt: new Date(), isPublic: isPublic !== false },
  });

  return NextResponse.json({ id: updated.id, answeredAt: updated.answeredAt, isPublic: updated.isPublic });
}
