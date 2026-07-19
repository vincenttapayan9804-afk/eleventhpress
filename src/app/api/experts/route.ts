import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/experts
 * Council of Experts' Directory — unlike /api/authors (built from every
 * PUBLISHED article's `authors` JSON, most of whom never register), every
 * entry here is a real, vetted User account with role === "EXPERT"
 * (promoted only via the Prestige Application approval flow, see
 * src/app/api/applications/[id]/review/route.ts). Insight output is
 * attributed by `correspondingAuthorId`, mirroring how the dashboard's
 * "My articles" already attributes ordinary submissions to their account.
 *
 * Ranked by published Expert Insight count, then follower count, then
 * views, then shares — the ranking criteria from the Publication Charter.
 * No weighted/fuzzy composite score, matching this platform's convention
 * of always sorting by clear, individually-inspectable metrics.
 */
export async function GET() {
  const experts = await db.user.findMany({
    where: { role: "EXPERT" },
    select: {
      id: true,
      fullName: true,
      expertTier: true,
      avatarUrl: true,
      profession: true,
      bio: true,
      website: true,
      twitterUrl: true,
      linkedinUrl: true,
      githubUrl: true,
      contactEmail: true,
      contactPhone: true,
      country: true,
      orcid: true,
      submissions: {
        where: { status: "PUBLISHED", contentType: "EXPERT_INSIGHT" },
        select: {
          id: true,
          title: true,
          insightCategory: true,
          publishedAt: true,
          doi: true,
          views: true,
          downloads: true,
          shares: true,
        },
        orderBy: { publishedAt: "desc" },
      },
      _count: { select: { followedBy: true } },
    },
  });

  const entries = experts.map((e) => {
    const categories = new Set<string>();
    let totalViews = 0;
    let totalDownloads = 0;
    let totalShares = 0;
    for (const a of e.submissions) {
      if (a.insightCategory) categories.add(a.insightCategory);
      totalViews += a.views;
      totalDownloads += a.downloads;
      totalShares += a.shares;
    }
    return {
      key: e.id,
      name: e.fullName,
      expertTier: e.expertTier,
      avatarUrl: e.avatarUrl,
      profession: e.profession,
      bio: e.bio,
      website: e.website,
      twitterUrl: e.twitterUrl,
      linkedinUrl: e.linkedinUrl,
      githubUrl: e.githubUrl,
      contactEmail: e.contactEmail,
      contactPhone: e.contactPhone,
      country: e.country,
      orcid: e.orcid,
      categories: [...categories],
      insightCount: e.submissions.length,
      totalViews,
      totalDownloads,
      totalShares,
      followerCount: e._count.followedBy,
      insights: e.submissions.map((a) => ({
        id: a.id,
        title: a.title,
        insightCategory: a.insightCategory,
        publishedAt: a.publishedAt,
        doi: a.doi,
      })),
    };
  });

  entries.sort((a, b) => {
    if (b.insightCount !== a.insightCount) return b.insightCount - a.insightCount;
    if (b.followerCount !== a.followerCount) return b.followerCount - a.followerCount;
    if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
    if (b.totalShares !== a.totalShares) return b.totalShares - a.totalShares;
    return a.name.localeCompare(b.name);
  });

  const totals = {
    experts: entries.length,
    insights: entries.reduce((s, e) => s + e.insightCount, 0),
    views: entries.reduce((s, e) => s + e.totalViews, 0),
    followers: entries.reduce((s, e) => s + e.followerCount, 0),
  };

  return NextResponse.json(
    { experts: entries, total: entries.length, totals },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } }
  );
}
