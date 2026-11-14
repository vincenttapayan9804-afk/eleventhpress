import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { getAuthorProfile } from "@/lib/author-profile";
import { ogCard, OG_SIZE } from "@/lib/og-card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Author profile";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const p = await getAuthorProfile(slug, tenant?.id ?? null).catch(() => null);
  const wlName = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : null;
  const brand = wlName ? { brand: wlName.slice(0, 40) } : {};
  if (!p) return ogCard({ eyebrow: "Author", title: wlName || "Eleventh Press International Publishing™", ...brand });
  return ogCard({
    ...brand,
    eyebrow: "Author profile",
    title: p.name,
    byline: [p.profession, p.affiliation].filter(Boolean).join(" · ") || p.disciplines.join(" · "),
    footer: `${p.articles.length} publication${p.articles.length === 1 ? "" : "s"} · ${p.disciplines.slice(0, 3).join(", ")}`,
  });
}
