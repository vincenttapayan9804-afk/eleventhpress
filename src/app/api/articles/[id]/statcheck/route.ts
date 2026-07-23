import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { runStatcheck } from "@/lib/statcheck";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * GET /api/articles/[id]/statcheck
 *
 * Real-time statcheck pass (src/lib/statcheck.ts) over the article's own
 * abstract + body text — pure recomputation, no external service, so this
 * runs synchronously on every request rather than as a durable job (same
 * reasoning as GET /api/articles/[id]/data-tables). Public and
 * unauthenticated, same open-access rationale as that route.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { status: true, abstract: true, galleyHtmlKey: true },
  });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ results: [] });
  }

  let bodyText = "";
  if (article.galleyHtmlKey) {
    const buf = await getObject(article.galleyHtmlKey);
    if (buf) {
      const match = buf.toString("utf-8").match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/);
      if (match) bodyText = stripTags(match[1]);
    }
  }

  const results = runStatcheck(`${article.abstract} ${bodyText}`);
  return NextResponse.json({ results });
}
