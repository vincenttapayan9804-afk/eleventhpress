import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { APP_BASE_URL } from "@/lib/site";

// Next.js treats sitemap.ts as a static metadata route by default and
// tries to prerender it at build time — this environment (like the rest of
// this app) has no database reachable at build time, only at request time.
// Forcing dynamic rendering also happens to be the correct behavior here
// regardless: a sitemap listing published articles should always reflect
// what's live right now, not a snapshot frozen at the last deploy.
export const dynamic = "force-dynamic";

/**
 * Next.js's native sitemap convention — auto-served at /sitemap.xml.
 * Lists every URL search engines can actually resolve: the homepage and
 * every published article's real page (see src/app/article/[id]/page.tsx —
 * before that route existed, these URLs 404'd, so listing them here would
 * have actively pointed crawlers at dead links).
 *
 * The rest of this app (browse, about, dashboard, etc.) is a client-side
 * SPA view-switch under "/" with no distinct URL per view (see
 * src/app/page.tsx) — nothing to list here for those until that changes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  return [
    { url: APP_BASE_URL, changeFrequency: "daily", priority: 1 },
    ...articles.map((a) => ({
      url: `${APP_BASE_URL}/article/${a.id}`,
      lastModified: a.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
