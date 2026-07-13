import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";

/**
 * GET /api/articles/[id]/body
 *
 * Returns the manuscript's real body content (already sanitized at galley
 * generation time — see src/lib/galley.ts) for inline display on the
 * public article page, distinct from the downloadable PDF/HTML galley
 * files. Public and unauthenticated, matching this platform's open-access
 * model — every published record carries an openAccess rights statement
 * in its OAI-PMH/Dublin Core metadata, so free-to-read is the intended
 * behavior here (the galley *download* endpoint's subscription gate is a
 * separate, deliberate distinction: read online free, pay for the
 * formatted file).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { status: true, galleyHtmlKey: true },
  });
  if (!article || article.status !== "PUBLISHED" || !article.galleyHtmlKey) {
    return NextResponse.json({ bodyHtml: null });
  }

  const buf = await getObject(article.galleyHtmlKey);
  if (!buf) {
    return NextResponse.json({ bodyHtml: null });
  }

  // The galley HTML we generate wraps the manuscript's real extracted
  // content in a single <div class="article-body">...</div> right before
  // </body> — everything else in that file (masthead, title, authors,
  // abstract, keywords) is already shown elsewhere on this page, so only
  // this div is relevant here. Absent for metadata-only galleys (no
  // extractable manuscript content, or Pandoc unavailable and format
  // unsupported by the in-process extractor).
  const html = buf.toString("utf-8");
  const match = html.match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/);
  return NextResponse.json({ bodyHtml: match ? match[1] : null });
}
