import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PREPRINT_ELIGIBLE_STATUSES } from "@/lib/article";

/**
 * GET /api/preprints?page=1&pageSize=20
 *
 * Public browse listing of manuscripts posted as preprints
 * (Article.isPreprint — src/app/api/articles/[id]/preprint/route.ts).
 * Deliberately returns only reader-safe fields, not the full authenticated
 * article-detail shape (GET /api/articles/[id]) — a preprint is not yet
 * peer reviewed, so integrity-check internals (plagiarismScore,
 * ithenticateScore/ReportUrl, integrityStatus) and Crossref deposit
 * bookkeeping stay out of the public response even though the manuscript
 * itself is public.
 */
export async function GET(req: NextRequest) {
  const page = Math.max(Number(req.nextUrl.searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get("pageSize")) || 20, 1), 50);

  const where = { isPreprint: true, status: { in: PREPRINT_ELIGIBLE_STATUSES } };

  const [rows, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: { preprintPostedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        abstract: true,
        keywords: true,
        discipline: true,
        authors: true,
        status: true,
        preprintPostedAt: true,
      },
    }),
    db.article.count({ where }),
  ]);

  return NextResponse.json({ items: rows, total, page, pageSize });
}
