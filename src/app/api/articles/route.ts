import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/articles
 * Public list/search of PUBLISHED articles.
 * Supports: ?q=keywords&discipline=Physics&sort=newest|cited|viewed&page=1&pageSize=12
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const discipline = searchParams.get("discipline") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(48, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10)));

  const where: any = { status: "PUBLISHED" };
  if (discipline) where.discipline = discipline;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { abstract: { contains: q } },
      { keywords: { contains: q } },
      { authors: { contains: q } },
    ];
  }

  let orderBy: any = { publishedAt: "desc" };
  if (sort === "cited") orderBy = { citations: "desc" };
  else if (sort === "viewed") orderBy = { views: "desc" };
  else if (sort === "title") orderBy = { title: "asc" };

  const [items, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { issue: true, journal: true },
    }),
    db.article.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      doi: a.doi,
      title: a.title,
      abstract: a.abstract,
      keywords: a.keywords,
      discipline: a.discipline,
      authors: a.authors,
      reviewModel: a.reviewModel,
      views: a.views,
      downloads: a.downloads,
      citations: a.citations,
      publishedAt: a.publishedAt,
      volume: a.issue?.volume ?? null,
      issueNumber: a.issue?.issueNumber ?? null,
      year: a.issue?.year ?? null,
      journalName: a.journal?.name,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
