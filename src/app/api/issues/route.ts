import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/issues
 * Lists journal issues with their published-article counts. Used to
 * populate issue pickers (e.g. the OJS export tab) — a generic resource
 * listing, parallel to /api/articles, not specific to any one export format.
 */
export async function GET() {
  const issues = await db.issue.findMany({
    orderBy: [{ year: "desc" }, { volume: "desc" }, { issueNumber: "desc" }],
    include: {
      _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
    },
  });

  return NextResponse.json({
    items: issues.map((i) => ({
      id: i.id,
      volume: i.volume,
      issueNumber: i.issueNumber,
      year: i.year,
      title: i.title,
      articleCount: i._count.articles,
    })),
  });
}
