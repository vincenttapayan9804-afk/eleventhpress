import { NextRequest, NextResponse } from "next/server";
import { getGuideDoc } from "@/lib/resources";
import { buildGuidePdf, guidePdfFileName } from "@/lib/guide-pdf";

/**
 * GET /resources/guides/[slug]/pdf — public, no auth. The official,
 * branded PDF edition of a Resources guide, rendered from the same content
 * as /resources/guides/[slug]. `?inline=1` opens it in the browser instead
 * of downloading. Content only changes on deploy, so it is cached at the
 * edge for a day.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideDoc(slug);
  if (!guide) return NextResponse.json({ error: "No guide with this name" }, { status: 404 });

  const pdf = await buildGuidePdf(guide);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${guidePdfFileName(guide)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
