import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildArchiveTemplate, buildSeriesTemplate, buildPaperTemplate } from "@/lib/redif";

/**
 * GET /api/redif?type=archive|series|papers
 *
 * Real ReDIF templates (see src/lib/redif.ts) for RePEc's own crawler —
 * IDEAS and EconPapers are front-ends over the same RePEc database, so
 * this one feed is what "integrating" with all three actually looks like.
 * Registering the feed with RePEc (getting a real archive code assigned)
 * is a one-time human application, not something this route can do on its
 * own — see repecLiveMode() in src/lib/redif.ts.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "archive";

  const journal = await db.journal.findFirst();
  if (!journal) {
    return textResponse("% No journal configured yet.");
  }

  if (type === "archive") {
    return textResponse(buildArchiveTemplate(journal));
  }

  if (type === "series") {
    return textResponse(buildSeriesTemplate(journal));
  }

  if (type === "papers") {
    const articles = await db.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }],
      take: 1000,
    });
    const templates = articles.map((a) => buildPaperTemplate(a)).join("\n\n");
    return textResponse(templates || "% No published articles yet.");
  }

  return NextResponse.json({ error: "type must be archive, series, or papers" }, { status: 400 });
}

// RePEc's crawler re-polls on its own schedule and tolerates eventual
// consistency, so a short edge cache cuts DB load without harvesters
// noticing — same reasoning as /api/oai-pmh's cache headers.
function textResponse(body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
