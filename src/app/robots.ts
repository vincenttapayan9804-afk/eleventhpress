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
  return {
    rules: [
      { userAgent: "Googlebot", allow: "/", disallow: ["/dashboard", "/admin", "/api/"] },
      { userAgent: "Bingbot", allow: "/", disallow: ["/dashboard", "/admin", "/api/"] },
      { userAgent: "Twitterbot", allow: "/", disallow: ["/dashboard", "/admin", "/api/"] },
      { userAgent: "facebookexternalhit", allow: "/", disallow: ["/dashboard", "/admin", "/api/"] },
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
