import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/crossref-log
 * Returns recent DOI / Crossref / indexing events from the audit log,
 * simulating the "Indexing & Discovery Service" control panel.
 */
export async function GET(req: NextRequest) {
  const logs = await db.auditLog.findMany({
    where: {
      action: { in: ["DOI_MINT", "DOI_PUBLISH", "PUBLISH"] },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      user: { select: { fullName: true, role: true } },
      article: { select: { id: true, title: true, doi: true, status: true, discipline: true } },
    },
  });

  const published = await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, doi: true, title: true, publishedAt: true, discipline: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      user: l.user,
      article: l.article,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
    })),
    published,
  });
}
