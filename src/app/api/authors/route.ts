import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseAuthors } from "@/lib/article";

/**
 * GET /api/authors
 * Public directory aggregated from every PUBLISHED article's `authors` JSON
 * field (not just registered accounts — most co-authors never register).
 * Grouped by ORCID where present, otherwise by normalized name, so the same
 * person's stats roll up across all their published articles.
 *
 * Registered accounts are automatically cross-referenced by ORCID (first
 * choice) or account email (fallback) so a matched entry's profile picture,
 * profession, bio, and social/contact links stay in sync with whatever the
 * author last saved in their dashboard — no separate publish step. Only the
 * account's opt-in public `contactEmail` is ever exposed here, never the
 * private login `email` used for matching.
 *
 * This does a full PUBLISHED-article scan plus a user cross-reference query
 * on every call and is identical for every visitor (no query params), so
 * it's cached at Vercel's CDN edge for a short window — an author's fresh
 * profile edit can take up to ~30s to appear here rather than being
 * instant, in exchange for not re-running this aggregation on every hit.
 */
export async function GET() {
  const articles = await db.article.findMany({
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
    },
    orderBy: { publishedAt: "desc" },
  });

  interface Entry {
    key: string;
    name: string;
    affiliation: string;
    orcid: string | null;
    email: string | null;
    disciplines: Set<string>;
    articleCount: number;
    totalViews: number;
    totalDownloads: number;
    totalCitations: number;
    articles: { id: string; title: string; discipline: string; publishedAt: Date | null; doi: string | null }[];
  }

  const byKey = new Map<string, Entry>();

  for (const a of articles) {
    for (const au of parseAuthors(a.authors)) {
      if (!au.name) continue;
      const key = (au.orcid || au.name).trim().toLowerCase();
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          name: au.name,
          affiliation: au.affiliation || "",
          orcid: au.orcid || null,
          email: au.email || null,
          disciplines: new Set(),
          articleCount: 0,
          totalViews: 0,
          totalDownloads: 0,
          totalCitations: 0,
          articles: [],
        };
        byKey.set(key, entry);
      }
      entry.articleCount += 1;
      entry.totalViews += a.views;
      entry.totalDownloads += a.downloads;
      entry.totalCitations += a.citations;
      entry.disciplines.add(a.discipline);
      entry.articles.push({ id: a.id, title: a.title, discipline: a.discipline, publishedAt: a.publishedAt, doi: a.doi });
    }
  }

  // Cross-reference registered accounts by ORCID or email so public
  // profile fields (avatar, profession, bio, social/contact links) come
  // straight from whatever the author currently has saved.
  const orcids = [...byKey.values()].map((e) => e.orcid).filter((v): v is string => !!v);
  const emails = [...byKey.values()].map((e) => e.email).filter((v): v is string => !!v);
  const accounts = orcids.length || emails.length
    ? await db.user.findMany({
        where: { OR: [...(orcids.length ? [{ orcid: { in: orcids } }] : []), ...(emails.length ? [{ email: { in: emails } }] : [])] },
        select: {
          id: true,
          orcid: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          profession: true,
          bio: true,
          website: true,
          twitterUrl: true,
          linkedinUrl: true,
          githubUrl: true,
          contactEmail: true,
          contactPhone: true,
        },
      })
    : [];
  const accountByOrcid = new Map(accounts.filter((u) => u.orcid).map((u) => [u.orcid as string, u]));
  const accountByEmail = new Map(accounts.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));

  const authors = [...byKey.values()]
    .map((e) => {
      const account = (e.orcid && accountByOrcid.get(e.orcid)) || (e.email && accountByEmail.get(e.email.toLowerCase())) || null;
      const { email, ...rest } = e;
      return {
        ...rest,
        disciplines: [...e.disciplines],
        hasAccount: !!account,
        avatarUrl: account?.avatarUrl || null,
        profession: account?.profession || null,
        bio: account?.bio || null,
        website: account?.website || null,
        twitterUrl: account?.twitterUrl || null,
        linkedinUrl: account?.linkedinUrl || null,
        githubUrl: account?.githubUrl || null,
        contactEmail: account?.contactEmail || null,
        contactPhone: account?.contactPhone || null,
      };
    })
    .sort((a, b) => b.articleCount - a.articleCount || b.totalCitations - a.totalCitations || a.name.localeCompare(b.name));

  return NextResponse.json(
    { authors, total: authors.length },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } }
  );
}
