import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { requestBaseUrl, resolveTenantFromHeaders } from "@/lib/tenant";

/**
 * Next.js's native robots convention — auto-served at /robots.txt,
 * replacing the previous static public/robots.txt (same per-agent Allow
 * rules, preserved below) which had no Sitemap: directive at all and, as
 * a static file, couldn't reference APP_BASE_URL — a self-hosted
 * deployment on a custom domain (see src/lib/site.ts) would otherwise
 * point crawlers at the wrong host for /sitemap.xml.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // A tenant's own domain points crawlers at its own sitemap.
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const base = await requestBaseUrl(tenant);
  // Google renders pages with JavaScript and obeys robots.txt for the data
  // a page loads while rendering. The article page and the article lists
  // load their (public) content from /api/articles, so blocking all of
  // /api/ left Googlebot's rendered article page without its abstract.
  // /api/articles is allowed (the longer, more specific rule wins); the
  // rest of /api/ stays blocked, and every /api/ response carries
  // X-Robots-Tag: noindex (next.config.ts) so the JSON itself is never
  // listed as a page.
  const allow = ["/", "/api/articles"];
  const disallow = ["/dashboard", "/admin", "/api/"];
  return {
    rules: ["Googlebot", "Bingbot", "Twitterbot", "facebookexternalhit", "*"].map((userAgent) => ({ userAgent, allow, disallow })),
    sitemap: `${base}/sitemap.xml`,
  };
}
