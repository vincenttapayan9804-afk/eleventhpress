import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";

/** Web app manifest: lets readers install the site and open saved articles offline. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const whitelabel = tenant && !tenant.isPlatform;
  const name = whitelabel ? tenant.siteName || tenant.name : "Eleventh Press International Publishing";
  return {
    name,
    short_name: whitelabel ? (tenant.name || name).slice(0, 12) : "Eleventh Press",
    description: "Open-access, peer-reviewed research — read, save and follow new publications.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8ff",
    theme_color: "#3b1466",
    categories: ["education", "books", "news"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Browse articles", url: "/articles" },
      { name: "My library", url: "/dashboard/library" },
      { name: "Dashboard", url: "/dashboard" },
    ],
  };
}
