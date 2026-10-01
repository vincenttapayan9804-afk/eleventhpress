import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_BASE_URL } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { buildArticlesRss } from "@/lib/articles-rss";

const FEED_ARTICLE_LIMIT = 50;

/**
 * GET /api/feed/articles.xml
 * Site-wide RSS 2.0 feed of the most recently published articles — see
 * src/lib/articles-rss.ts for why RSS rather than a per-platform API.
 * Same tenant resolution as sitemap.ts, so a whitelabel tenant's feed only
 * ever lists its own articles.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers);
  const articles = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, abstract: true, discipline: true, authors: true, doi: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: FEED_ARTICLE_LIMIT,
    })
  );

  const feedUrl = `${APP_BASE_URL}/api/feed/articles.xml`;
  const xml = buildArticlesRss(
    {
      title: tenant?.siteName || "Eleventh Press",
      description: "Recently published articles",
      siteUrl: APP_BASE_URL,
      feedUrl,
      language: "en",
    },
    articles.map((a) => ({
      id: a.id,
      title: a.title,
      abstract: a.abstract,
      discipline: a.discipline,
      authors: a.authors,
      doi: a.doi,
      publishedAt: a.publishedAt,
      canonicalUrl: `${APP_BASE_URL}/article/${a.id}`,
    }))
  );

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
