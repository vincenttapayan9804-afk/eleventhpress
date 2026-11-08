import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { APP_BASE_URL } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { BLOGS, GUIDES } from "@/lib/resources-content";
import { articlePath, SITEMAP_PATHS } from "@/lib/spa-routes";

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
 * Also lists the server-rendered Resources blog posts and guides
 * (src/app/resources/...) and the public pages of the single-page site
 * (/articles, /about, ... — src/lib/spa-routes.ts), each of which now has
 * its own URL.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await resolveTenantFromHeaders(await headers());
  const articles = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
    })
  );

  return [
    { url: APP_BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${APP_BASE_URL}/cookie-policy`, changeFrequency: "yearly", priority: 0.2 },
    ...SITEMAP_PATHS.map((path) => ({
      url: `${APP_BASE_URL}${path}`,
      changeFrequency: (path === "/articles" ? "daily" : "monthly") as "daily" | "monthly",
      priority: path === "/articles" ? 0.9 : 0.5,
    })),
    // Resources blog posts and official guides (server-rendered pages).
    ...BLOGS.map((b) => ({
      url: `${APP_BASE_URL}/resources/blog/${b.slug}`,
      lastModified: new Date(`${b.dateModified}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...GUIDES.map((g) => ({
      url: `${APP_BASE_URL}/resources/guides/${g.slug}`,
      lastModified: new Date(`${g.effective}T00:00:00Z`),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...articles.map((a) => ({
      url: `${APP_BASE_URL}${articlePath(a.id, a.title)}`,
      lastModified: a.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
