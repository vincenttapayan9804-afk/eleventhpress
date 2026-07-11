import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOjsArticleXml } from "@/lib/ojs-native";

/**
 * GET /api/export/ojs/article/[id]
 * Returns a standalone PKP Native XML <article> element for one article,
 * for hand-import into a real OJS installation's Native Import/Export
 * plugin. Mirrors /api/crossref/xml/[id]'s pattern (unauthenticated GET,
 * raw XML response) — article metadata is already public via
 * /api/articles/[id].
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
${await buildOjsArticleXml({ article, issue: article.issue, journal: article.journal })}`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
