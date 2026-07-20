import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/datasets?page=1&pageSize=20
 *
 * Public browse/discovery listing of every dataset deposited via
 * POST /api/datasets/zenodo, across every PUBLISHED article — previously
 * datasets were only ever visible one article at a time (the article
 * page's DatasetsSection). Real, deposited data only: never a synthesized
 * or placeholder entry.
 */
export async function GET(req: NextRequest) {
  const page = Math.max(Number(req.nextUrl.searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get("pageSize")) || 20, 1), 50);

  const where = { article: { status: "PUBLISHED" as const } };

  const [rows, total] = await Promise.all([
    db.datasetLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        repository: true,
        datasetDoi: true,
        datasetUrl: true,
        datasetTitle: true,
        relationType: true,
        createdAt: true,
        article: { select: { id: true, title: true, discipline: true } },
      },
    }),
    db.datasetLink.count({ where }),
  ]);

  return NextResponse.json({ items: rows, total, page, pageSize });
}
