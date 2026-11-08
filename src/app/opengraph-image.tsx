import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { ogCard, OG_SIZE } from "@/lib/og-card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Share image";

/** Site-wide default share image, in the visiting site's own name (whitelabel tenants included). */
export default async function Image() {
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const name = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : "Eleventh Press International Publishing";
  return ogCard({
    eyebrow: "Open-access, peer-reviewed",
    title: name,
    byline: "Rigorous review, real DOIs and open access across every discipline.",
    footer: "Articles · Books · Magazines · Podcasts",
    brand: tenant && !tenant.isPlatform ? (tenant.name || "").slice(0, 40) : "Eleventh Press",
  });
}
