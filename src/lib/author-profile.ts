import { db } from "@/lib/db";
import { parseAuthors } from "@/lib/article";
import { withTenantRlsContext } from "@/lib/db-rls";
import { authorSlug } from "@/lib/author-path";
import { computeHIndex, fetchAuthorCitationMetrics } from "@/lib/citation-metrics";

/**
 * Public author profiles at /authors/<slug>. The slug is the author's ORCID
 * iD when they have one, otherwise their name slugified — the same grouping
 * /api/authors uses for the directory, so a profile always matches its
 * directory card. Built from every PUBLISHED article's author list, then
 * enriched with the matching registered account's public profile fields.
 */

export { authorSlug, authorPath } from "@/lib/author-path";

export async function getAuthorProfile(slug: string, tenantId: string | null) {
  const wanted = decodeURIComponent(slug).toUpperCase();
  const articles = await withTenantRlsContext(tenantId, (tx) =>
    tx.article.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, discipline: true, authors: true, publishedAt: true, doi: true, views: true, downloads: true, citations: true, abstract: true },
      orderBy: { publishedAt: "desc" },
    })
  );

  let name = "";
  let affiliation = "";
  let orcid: string | null = null;
  let email: string | null = null;
  const mine: typeof articles = [];
  const coAuthors = new Map<string, { name: string; slug: string; count: number }>();
  for (const a of articles) {
    const list = parseAuthors(a.authors);
    const me = list.find((au) => au.name && authorSlug(au).toUpperCase() === wanted);
    if (!me) continue;
    mine.push(a);
    if (!name) {
      name = me.name;
      affiliation = me.affiliation || "";
      orcid = me.orcid || null;
      email = me.email || null;
    }
    for (const co of list) {
      if (!co.name || co === me) continue;
      const s = authorSlug(co);
      const c = coAuthors.get(s) ?? { name: co.name, slug: s, count: 0 };
      c.count++;
      coAuthors.set(s, c);
    }
  }
  if (!mine.length) return null;

  const account = await db.user
    .findFirst({
      where: { OR: [...(orcid ? [{ orcid }] : []), ...(email ? [{ email }] : [])], deletedAt: null },
      select: {
        id: true,
        avatarUrl: true,
        profession: true,
        bio: true,
        website: true,
        twitterUrl: true,
        linkedinUrl: true,
        githubUrl: true,
        contactEmail: true,
        country: true,
        affiliation: true,
        _count: { select: { followedBy: true } },
      },
    })
    .catch(() => null);

  const live = orcid ? await fetchAuthorCitationMetrics(orcid).catch(() => null) : null;
  const totals = mine.reduce(
    (t, a) => ({ views: t.views + a.views, downloads: t.downloads + a.downloads, citations: t.citations + a.citations }),
    { views: 0, downloads: 0, citations: 0 }
  );

  return {
    slug: authorSlug({ name, orcid }),
    name,
    affiliation: account?.affiliation || affiliation,
    orcid,
    accountId: account?.id ?? null,
    followerCount: account?._count.followedBy ?? 0,
    avatarUrl: account?.avatarUrl ?? null,
    profession: account?.profession ?? null,
    bio: account?.bio ?? null,
    country: account?.country ?? null,
    links: {
      website: account?.website ?? null,
      twitter: account?.twitterUrl ?? null,
      linkedin: account?.linkedinUrl ?? null,
      github: account?.githubUrl ?? null,
      email: account?.contactEmail ?? null,
    },
    disciplines: [...new Set(mine.map((a) => a.discipline))],
    totals,
    metrics: live
      ? { hIndex: live.hIndex, citedBy: live.citedByCount, works: live.worksCount, source: "openalex" as const }
      : { hIndex: computeHIndex(mine.map((a) => a.citations)), citedBy: totals.citations, works: mine.length, source: "platform" as const },
    articles: mine.map((a) => ({
      id: a.id,
      title: a.title,
      discipline: a.discipline,
      doi: a.doi,
      publishedAt: a.publishedAt,
      citations: a.citations,
      views: a.views,
      abstract: a.abstract.slice(0, 280),
      authors: parseAuthors(a.authors).map((x) => ({ name: x.name, slug: authorSlug(x) })),
    })),
    coAuthors: [...coAuthors.values()].sort((a, b) => b.count - a.count).slice(0, 12),
  };
}

export type AuthorProfile = NonNullable<Awaited<ReturnType<typeof getAuthorProfile>>>;
