import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/admin/galley-jobs
 * Lists the most recent GalleyJob rows across all articles, for the admin
 * portal's operational visibility panel — surfaces stuck/failed jobs that
 * would otherwise be invisible between cron sweeps. SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const jobs = await db.galleyJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // GalleyJob.articleId is a plain indexed column, not a Prisma relation
  // (see prisma/schema.prisma) — join the article titles in JS rather than
  // adding a schema relation just for this admin list view.
  const articleIds = Array.from(new Set(jobs.map((j) => j.articleId)));
  const articles = await db.article.findMany({
    where: { id: { in: articleIds } },
    select: { id: true, title: true },
  });
  const titleById = new Map(articles.map((a) => [a.id, a.title]));

  return NextResponse.json({
    jobs: jobs.map((j) => ({ ...j, articleTitle: titleById.get(j.articleId) || null })),
  });
}
