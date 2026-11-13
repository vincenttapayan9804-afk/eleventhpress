import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { hexOr } from "@/lib/publisher-identity";

/** Web app manifest: lets readers install the site and open saved articles offline. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const whitelabel = tenant && !tenant.isPlatform;
  const name = whitelabel ? tenant.siteName || tenant.name : "Eleventh Press International Publishing";
  // Tenant-specific icon URL (its own logo/initials), cached per tenant.
  const iconQuery = whitelabel ? `?t=${encodeURIComponent(tenant.slug)}` : "";
  const theme = whitelabel ? hexOr(tenant.primaryColor, "#3b1466") : "#3b1466";
  return {
    name,
    short_name: whitelabel ? (tenant.name || name).slice(0, 12) : "Eleventh Press",
    description: "Open-access, peer-reviewed research — read, save and follow new publications.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8ff",
    theme_color: theme,
    categories: ["education", "books", "news"],
    icons: [
      { src: `/pwa-icon/192${iconQuery}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/pwa-icon/512${iconQuery}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/pwa-icon/512${iconQuery}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Browse articles", url: "/articles" },
      { name: "My library", url: "/dashboard/library" },
      { name: "Dashboard", url: "/dashboard" },
    ],
  };
}
