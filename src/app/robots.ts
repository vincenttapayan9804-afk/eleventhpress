import type { MetadataRoute } from "next";
import { APP_BASE_URL } from "@/lib/site";

/**
 * Next.js's native robots convention — auto-served at /robots.txt,
 * replacing the previous static public/robots.txt (same per-agent Allow
 * rules, preserved below) which had no Sitemap: directive at all and, as
 * a static file, couldn't reference APP_BASE_URL — a self-hosted
 * deployment on a custom domain (see src/lib/site.ts) would otherwise
 * point crawlers at the wrong host for /sitemap.xml.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },
      { userAgent: "Twitterbot", allow: "/" },
      { userAgent: "facebookexternalhit", allow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${APP_BASE_URL}/sitemap.xml`,
  };
}
