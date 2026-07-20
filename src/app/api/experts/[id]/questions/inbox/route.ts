import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/experts/[id]/questions/inbox
 *
 * The expert's own view of every question they've received — pending,
 * answered, public, and privately-answered alike. Only the expert
 * themselves (or SUPER_ADMIN) can read this; the asker's name is included
 * here (unlike the public GET, which never attributes a question to
 * anyone) since the expert answering needs to know who's asking.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: expertId } = await params;
  if (session.userId !== expertId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const questions = await db.expertQuestion.findMany({
    where: { expertId },
    orderBy: [{ answeredAt: "asc" }, { createdAt: "desc" }],
    include: { askedBy: { select: { fullName: true } } },
  });

  return NextResponse.json({
    items: questions.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      answeredAt: q.answeredAt,
      isPublic: q.isPublic,
      createdAt: q.createdAt,
      askerName: q.askedBy.fullName,
    })),
  });
}
