import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { getAuthorProfile, IDENTITY_LABEL } from "@/lib/author-profile";
import { displayCase } from "@/lib/author-path";
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
    eyebrow: `${IDENTITY_LABEL[p.verification.identity].badge} · Author profile`,
    title: displayCase(p.name),
    byline: [displayCase(p.profession), p.affiliation].filter(Boolean).join(" · ") || p.disciplines.join(" · "),
    footer: `${p.articles.length} publication${p.articles.length === 1 ? "" : "s"} · ${p.verification.checks.sealed} provenance-sealed · ${p.disciplines.slice(0, 2).join(", ")}`,
  });
}
