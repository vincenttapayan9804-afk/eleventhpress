import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getPodcastPlatform, buildPodcastPackage, PODCAST_PLATFORMS } from "@/lib/podcast-distribution";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * GET /api/podcast-distribution?podcastId=X
 * Lists every PodcastDistribution row for the show, including platforms
 * that have never been generated (returned as NOT_STARTED stubs), same
 * shape as GET /api/book-distribution. Editorial-only.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const podcastId = new URL(req.url).searchParams.get("podcastId");
  if (!podcastId) return NextResponse.json({ error: "podcastId is required" }, { status: 400 });

  const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
  if (!podcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const publishedCount = await db.podcastEpisode.count({ where: { podcastId, status: "PUBLISHED" } });
  if (publishedCount === 0) {
    return NextResponse.json({ error: "Distribution is only available once a show has at least one published episode" }, { status: 400 });
  }

  const rows = await db.podcastDistribution.findMany({ where: { podcastId } });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));

  const items = PODCAST_PLATFORMS.map((p) => {
    const existing = byPlatform.get(p.id);
    return existing || {
      id: null,
      podcastId,
      platform: p.id,
      tier: p.tier,
      status: "NOT_STARTED",
      packageContent: null,
      externalUrl: null,
      submittedAt: null,
    };
  });

  return NextResponse.json({ items });
}

/**
 * POST /api/podcast-distribution { podcastId, platform, consent? }
 * Generates (or regenerates) the metadata package (title/hosts/description/
 * feed URL) for a directory. Upserts on the (podcastId, platform) unique
 * constraint. Requires at least one published episode. Every platform is
 * Tier B and requires `consent: true` (or an already-recorded consent).
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { podcastId, platform, consent } = (await req.json()) as { podcastId?: string; platform?: string; consent?: boolean };
  if (!podcastId || !platform) {
    return NextResponse.json({ error: "podcastId and platform are required" }, { status: 400 });
  }
  const platformDef = getPodcastPlatform(platform);
  if (!platformDef) return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });

  const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
  if (!podcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const publishedCount = await db.podcastEpisode.count({ where: { podcastId, status: "PUBLISHED" } });
  if (publishedCount === 0) {
    return NextResponse.json({ error: "Distribution is only available once a show has at least one published episode" }, { status: 400 });
  }

  const existing = await db.podcastDistribution.findUnique({ where: { podcastId_platform: { podcastId, platform } } });
  const hasConsent = !!consent || !!existing?.authorConsent;
  if (!hasConsent) {
    return NextResponse.json({ error: "Consent is required before generating a submission package for this platform" }, { status: 400 });
  }

  const pkg = buildPodcastPackage(podcast);

  const row = await db.podcastDistribution.upsert({
    where: { podcastId_platform: { podcastId, platform } },
    create: {
      podcastId,
      platform,
      tier: platformDef.tier,
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(pkg),
      authorConsent: true,
      consentedAt: new Date(),
    },
    update: {
      status: "PACKAGE_READY",
      packageContent: JSON.stringify(pkg),
      authorConsent: true,
      consentedAt: new Date(),
    },
  });

  return NextResponse.json({ item: row, package: pkg });
}
