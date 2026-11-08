import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const DAY = 86400000;

/**
 * GET /api/author-analytics?days=90 — readership of the signed-in author's
 * published articles (as corresponding author): totals, daily views and
 * downloads, top countries and referring sites (recorded from Nov 2026),
 * and a per-article table with citations.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const days = Math.min(365, Math.max(7, parseInt(req.nextUrl.searchParams.get("days") || "90", 10) || 90));
  const since = new Date(Date.now() - days * DAY);

  const articles = await db.article.findMany({
    where: { correspondingAuthorId: session.userId, status: "PUBLISHED" },
    select: { id: true, title: true, publishedAt: true, views: true, downloads: true, citations: true, doi: true },
    orderBy: { publishedAt: "desc" },
  });
  const ids = articles.map((a) => a.id);
  const events = ids.length
    ? await db.counterEvent.findMany({
        where: { articleId: { in: ids }, createdAt: { gte: since } },
        select: { articleId: true, metricType: true, country: true, referrer: true, createdAt: true },
        take: 200000,
      })
    : [];

  const series = new Map<string, { date: string; views: number; downloads: number }>();
  for (let t = since.getTime(); t <= Date.now(); t += DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    series.set(d, { date: d, views: 0, downloads: 0 });
  }
  const countries = new Map<string, number>();
  const referrers = new Map<string, number>();
  const perArticle = new Map<string, { views: number; downloads: number }>();
  for (const e of events) {
    const d = e.createdAt.toISOString().slice(0, 10);
    const row = series.get(d);
    const isView = e.metricType === "Total_Item_Investigations";
    const pa = perArticle.get(e.articleId!) ?? { views: 0, downloads: 0 };
    if (isView) {
      if (row) row.views++;
      pa.views++;
    } else {
      if (row) row.downloads++;
      pa.downloads++;
    }
    perArticle.set(e.articleId!, pa);
    if (isView && e.country) countries.set(e.country, (countries.get(e.country) ?? 0) + 1);
    if (isView) referrers.set(e.referrer || "Direct or search", (referrers.get(e.referrer || "Direct or search") ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

  return NextResponse.json({
    days,
    totals: {
      articles: articles.length,
      views: articles.reduce((s, a) => s + a.views, 0),
      downloads: articles.reduce((s, a) => s + a.downloads, 0),
      citations: articles.reduce((s, a) => s + a.citations, 0),
      periodViews: events.filter((e) => e.metricType === "Total_Item_Investigations").length,
      periodDownloads: events.filter((e) => e.metricType !== "Total_Item_Investigations").length,
    },
    series: [...series.values()],
    countries: top(countries),
    referrers: top(referrers),
    articles: articles.map((a) => ({ ...a, period: perArticle.get(a.id) ?? { views: 0, downloads: 0 } })),
  });
}
