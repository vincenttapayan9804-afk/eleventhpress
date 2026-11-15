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
 *
 * Every profile also carries its verification record, built only from
 * facts the platform holds and can show again on request:
 *   - identity: whether the person behind the byline signed in with ORCID
 *     (the iD on the manuscript was proven by ORCID itself), proved the
 *     email address listed on the manuscript, or has no account at all;
 *   - per publication: its provenance seal (/verify/article/<id>), its DOI,
 *     and whether the author confirmed their authorship (as the submitting
 *     author, or through the emailed co-author confirmation);
 *   - certificates issued to the account (/verify/<serial>);
 *   - any correction, expression of concern or retraction, shown openly.
 */

export { authorSlug, authorPath } from "@/lib/author-path";

const cleanOrcid = (v: string | null | undefined) => (v || "").replace(/^https?:\/\/orcid\.org\//, "").trim().toUpperCase();

export type IdentityLevel = "orcid-authenticated" | "verified-account" | "account" | "listed";

/** How sure the platform is that the person on this page is the person on the bylines. */
export function identityLevel(
  orcid: string | null,
  account: { orcid?: string | null; orcidLastSync?: Date | null; emailVerifiedAt?: Date | null } | null
): IdentityLevel {
  if (!account) return "listed";
  if (orcid && account.orcidLastSync && cleanOrcid(account.orcid) === cleanOrcid(orcid)) return "orcid-authenticated";
  if (account.emailVerifiedAt) return "verified-account";
  return "account";
}

export const IDENTITY_LABEL: Record<IdentityLevel, { badge: string; detail: string }> = {
  "orcid-authenticated": {
    badge: "Verified author",
    detail: "Signed in with ORCID: ORCID itself confirmed this person holds the iD listed on their publications.",
  },
  "verified-account": {
    badge: "Verified author",
    detail: "Holds an account and proved ownership of the email address listed on their publications.",
  },
  account: {
    badge: "Registered author",
    detail: "Holds an account matched to their publications; the email address has not been confirmed yet.",
  },
  listed: {
    badge: "Listed author",
    detail: "Named on published articles. This person has not claimed the profile with an account yet.",
  },
};

export interface RecordCheck {
  sealed: number;
  withDoi: number;
  authorshipConfirmed: number;
  total: number;
}

/** Totals for the verification panel. */
export function summarizeChecks(articles: { sealed: boolean; doi: string | null; authorship: string | null }[]): RecordCheck {
  return {
    sealed: articles.filter((a) => a.sealed).length,
    withDoi: articles.filter((a) => !!a.doi).length,
    authorshipConfirmed: articles.filter((a) => !!a.authorship).length,
    total: articles.length,
  };
}

export async function getAuthorProfile(slug: string, tenantId: string | null) {
  const wanted = decodeURIComponent(slug).toUpperCase();
  const articles = await withTenantRlsContext(tenantId, (tx) =>
    tx.article.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        discipline: true,
        authors: true,
        publishedAt: true,
        doi: true,
        views: true,
        downloads: true,
        citations: true,
        abstract: true,
        keywords: true,
        contentType: true,
        integrityStatus: true,
        contentHash: true,
        provenanceSealedAt: true,
        correspondingAuthorId: true,
        journal: { select: { name: true } },
        issue: { select: { volume: true, issueNumber: true, year: true } },
      },
      orderBy: { publishedAt: "desc" },
    })
  );

  let name = "";
  let affiliation = "";
  let orcid: string | null = null;
  let email: string | null = null;
  const mine: (typeof articles)[number][] = [];
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
        orcid: true,
        orcidLastSync: true,
        emailVerifiedAt: true,
        createdAt: true,
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
        academicStatus: true,
        department: { select: { name: true, slug: true } },
        certificates: {
          select: { serialNumber: true, type: true, category: true, workTitle: true, journalName: true, issuedAt: true },
          orderBy: { issuedAt: "desc" },
          take: 8,
        },
        _count: { select: { followedBy: true } },
      },
    })
    .catch(() => null);

  // Authorship the author confirmed through the emailed co-author link.
  const confirmed = email
    ? await db.authorshipConfirmation
        .findMany({
          where: { articleId: { in: mine.map((a) => a.id) }, email: email.trim().toLowerCase(), status: "CONFIRMED" },
          select: { articleId: true, creditRoles: true },
        })
        .catch(() => [] as { articleId: string; creditRoles: string[] }[])
    : [];
  const confirmedBy = new Map(confirmed.map((c) => [c.articleId, c.creditRoles]));

  const live = orcid ? await fetchAuthorCitationMetrics(orcid).catch(() => null) : null;
  const totals = mine.reduce(
    (t, a) => ({ views: t.views + a.views, downloads: t.downloads + a.downloads, citations: t.citations + a.citations }),
    { views: 0, downloads: 0, citations: 0 }
  );

  // Research topics: the keywords that recur across this author's work.
  const topicCounts = new Map<string, { label: string; n: number }>();
  for (const a of mine) {
    for (const k of (a.keywords || "").split(/[,;]/)) {
      const label = k.trim();
      if (label.length < 3 || label.length > 48) continue;
      const key = label.toLowerCase();
      const t = topicCounts.get(key) ?? { label, n: 0 };
      t.n++;
      topicCounts.set(key, t);
    }
  }
  const topics = [...topicCounts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 12).map((t) => t.label);

  const years = mine.map((a) => a.publishedAt?.getFullYear()).filter((y): y is number => typeof y === "number");
  const identity = identityLevel(orcid, account);

  const publications = mine.map((a) => {
    const submitting = !!account && a.correspondingAuthorId === account.id;
    const roles = confirmedBy.get(a.id);
    return {
      id: a.id,
      title: a.title,
      discipline: a.discipline,
      contentType: a.contentType,
      doi: a.doi,
      publishedAt: a.publishedAt,
      journal: a.journal?.name ?? null,
      issue: a.issue ? { volume: a.issue.volume, number: a.issue.issueNumber, year: a.issue.year } : null,
      citations: a.citations,
      views: a.views,
      downloads: a.downloads,
      abstract: a.abstract.slice(0, 320),
      integrity: a.integrityStatus && a.integrityStatus !== "NORMAL" ? a.integrityStatus : null,
      sealed: !!a.contentHash && !!a.provenanceSealedAt,
      authorship: submitting ? ("submitting" as const) : roles ? ("confirmed" as const) : null,
      creditRoles: roles ?? [],
      authors: parseAuthors(a.authors).map((x) => ({ name: x.name, slug: authorSlug(x) })),
    };
  });

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
    academicStatus: account?.academicStatus ?? null,
    department: account?.department ?? null,
    memberSince: account?.createdAt ?? null,
    links: {
      website: account?.website ?? null,
      twitter: account?.twitterUrl ?? null,
      linkedin: account?.linkedinUrl ?? null,
      github: account?.githubUrl ?? null,
      email: account?.contactEmail ?? null,
    },
    disciplines: [...new Set(mine.map((a) => a.discipline))],
    topics,
    firstYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    totals,
    metrics: live
      ? { hIndex: live.hIndex, i10Index: live.i10Index, citedBy: live.citedByCount, works: live.worksCount, source: "openalex" as const }
      : { hIndex: computeHIndex(mine.map((a) => a.citations)), i10Index: null, citedBy: totals.citations, works: mine.length, source: "platform" as const },
    verification: {
      identity,
      orcidAuthenticated: identity === "orcid-authenticated",
      checks: summarizeChecks(publications),
      certificates: (account?.certificates ?? []).map((c) => ({
        serialNumber: c.serialNumber,
        type: c.type,
        category: c.category,
        workTitle: c.workTitle,
        journalName: c.journalName,
        issuedAt: c.issuedAt,
      })),
      checkedAt: new Date(),
    },
    articles: publications,
    coAuthors: [...coAuthors.values()].sort((a, b) => b.count - a.count).slice(0, 12),
  };
}

export type AuthorProfile = NonNullable<Awaited<ReturnType<typeof getAuthorProfile>>>;
