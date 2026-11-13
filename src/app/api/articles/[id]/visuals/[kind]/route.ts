import { NextRequest, NextResponse } from "next/server";
import { loadResearchVisual } from "@/lib/research-visuals-server";
import {
  buildResearchVisualPdf,
  researchVisualFileName,
  RESEARCH_VISUAL_KINDS,
  type ResearchVisualKind,
} from "@/lib/research-visuals-pdf";

/**
 * GET /api/articles/[id]/visuals/[kind] — public for published articles,
 * like the galley and data-table PDFs. `kind` is one of:
 *
 *   infographic         research infographic (Galleys)
 *   poster              conference-ready A0 research poster (Galleys)
 *   graphical-abstract  graphical abstract (Supplemental)
 *   framework           theoretical framework / conceptual paradigm (Supplemental)
 *
 * Branded with the publishing tenant's identity (src/lib/research-visuals-pdf.ts).
 * Add ?inline=1 to view instead of download. The first request for an
 * article analyses it (cached afterwards), so allow up to a minute.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!RESEARCH_VISUAL_KINDS.includes(kind as ResearchVisualKind)) {
    return NextResponse.json({ error: `Unknown visual "${kind}"` }, { status: 404 });
  }
  const loaded = await loadResearchVisual(id, kind as ResearchVisualKind, req.headers);
  if (!loaded) {
    return NextResponse.json({ error: "No published article with this ID" }, { status: 404 });
  }
  let pdf: Buffer;
  try {
    pdf = await buildResearchVisualPdf(kind as ResearchVisualKind, loaded.input);
  } catch (e) {
    console.error(`[visuals] ${kind} render failed for ${id}`, e);
    return NextResponse.json({ error: "Could not generate this document right now. Please try again." }, { status: 500 });
  }
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${researchVisualFileName({ title: loaded.title }, kind as ResearchVisualKind)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
