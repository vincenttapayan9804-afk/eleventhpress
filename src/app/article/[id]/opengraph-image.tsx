import { db } from "@/lib/db";
import { parseAuthors } from "@/lib/article";
import { articleIdFromSegment } from "@/lib/spa-routes";
import { ogCard, OG_SIZE } from "@/lib/og-card";
import { headers } from "next/headers";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { publisherIdentityForJournal } from "@/lib/publisher-identity";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Article";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = decodeURIComponent(id);
  const select = { title: true, authors: true, discipline: true, doi: true, publishedAt: true, status: true, journal: { select: { name: true, publisher: true, issn: true, tenantId: true } } } as const;
  const a =
    (await db.article.findUnique({ where: { id: raw }, select }).catch(() => null)) ??
    (await db.article.findUnique({ where: { id: articleIdFromSegment(id) }, select }).catch(() => null));
  if (!a || a.status !== "PUBLISHED") {
    // The visiting site's own name — a whitelabel tenant never shows Eleventh Press.
    const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
    const wl = tenant && !tenant.isPlatform;
    return ogCard({
      eyebrow: "Open-access research",
      title: wl ? tenant.siteName || tenant.name : "Eleventh Press International Publishing",
      ...(wl ? { brand: (tenant.siteName || tenant.name).slice(0, 40) } : {}),
    });
  }
  const identity = await publisherIdentityForJournal(a.journal);
  const names = parseAuthors(a.authors).map((x) => x.name).filter(Boolean);
  const byline = names.length > 3 ? `${names.slice(0, 3).join(", ")} et al.` : names.join(", ");
  return ogCard({
    eyebrow: a.discipline,
    title: a.title,
    byline,
    footer: [a.journal?.name, a.publishedAt?.getFullYear(), a.doi ? `doi:${a.doi}` : null].filter(Boolean).join(" · "),
    ...(identity.whitelabel ? { brand: identity.shortName.slice(0, 40) } : {}),
  });
}
