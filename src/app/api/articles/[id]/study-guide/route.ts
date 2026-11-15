import { after, NextRequest, NextResponse } from "next/server";
import { requestStudyGuideUpgrade, serveStudyGuide } from "@/lib/study-guide/server";

/**
 * GET /api/articles/[id]/study-guide — the article's Research Study
 * Guide, a self-contained interactive HTML file (src/lib/study-guide/*).
 * Public for published articles, like the galleys. Every published article
 * has one ready: it is built at publish time and by the daily sweep, and
 * this route serves the stored file. Add ?inline=1 to open it in the
 * browser instead of downloading.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let served;
  try {
    served = await serveStudyGuide(id, req.headers);
  } catch (e) {
    console.error(`[study-guide] serve failed for ${id}`, e);
    return NextResponse.json({ error: "Could not prepare the study guide right now. Please try again." }, { status: 500 });
  }
  if (!served) return NextResponse.json({ error: "No published article with this ID" }, { status: 404 });
  if (served.needsUpgrade) after(() => requestStudyGuideUpgrade(id));
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const body = Buffer.from(served.html, "utf-8");
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${served.fileName}"`,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
