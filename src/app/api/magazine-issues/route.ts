import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";

/**
 * GET /api/magazine-issues
 * Public — every PUBLISHED issue across every magazine, newest first, with
 * the parent magazine's name/slug embedded and its cover-story piece's
 * title (if any) so the archive page's hero/grid needs one request instead
 * of N (one per magazine). Unlike GET /api/magazines/[id] (issues within
 * ONE magazine, any status for editorial staff), this is cross-magazine
 * and PUBLISHED-only — it's the public browse feed, not a management view.
 */
export async function GET() {
  const issues = await db.magazineIssue.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      magazine: { select: { name: true, slug: true } },
      pieces: { where: { isCoverStory: true }, select: { title: true, dek: true }, take: 1 },
    },
  });

  const withUrls = await Promise.all(
    issues.map(async (i) => ({
      id: i.id,
      magazineName: i.magazine.name,
      magazineSlug: i.magazine.slug,
      volume: i.volume,
      issueNumber: i.issueNumber,
      year: i.year,
      title: i.title,
      theme: i.theme,
      publishedAt: i.publishedAt,
      coverImageUrl: i.coverImageKey ? await presignGet(i.coverImageKey) : null,
      coverStoryTitle: i.pieces[0]?.title || null,
      coverStoryDek: i.pieces[0]?.dek || null,
    }))
  );

  return NextResponse.json({ issues: withUrls });
}
