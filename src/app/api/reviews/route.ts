import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/reviews?scope=mine  — reviews assigned to current user
 * GET /api/reviews?articleId=… — reviews for an article (editor view)
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const articleId = searchParams.get("articleId");

  if (articleId) {
    if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Editor role required" }, { status: 403 });
    }
    const reviews = await db.review.findMany({
      where: { articleId },
      include: {
        reviewer: {
          select: { id: true, fullName: true, affiliation: true, orcid: true, expertise: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ reviews });
  }

  if (scope === "mine") {
    const reviews = await db.review.findMany({
      where: { reviewerId: session.userId },
      include: { article: { include: { journal: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ reviews });
  }

  return NextResponse.json({ error: "Missing scope or articleId" }, { status: 400 });
}
