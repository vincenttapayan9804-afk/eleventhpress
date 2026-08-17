import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { buildPodcastRss } from "@/lib/podcast-rss";
import { APP_BASE_URL } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * presignGet returns a relative /api/storage/download URL in local-
 * filesystem storage mode (fine for in-app links, which resolve against
 * the browser's current origin) — but an RSS <enclosure> is fetched by a
 * third-party server with no "current origin" to resolve against, so it
 * must always be absolute.
 */
async function absoluteAssetUrl(key: string): Promise<string> {
  const url = await presignGet(key);
  return url.startsWith("/") ? `${APP_BASE_URL}${url}` : url;
}

/**
 * GET /api/podcasts/[id]/rss.xml
 * Public, unauthenticated — the real feed URL a staff member pastes into
 * Apple Podcasts Connect/Spotify for Podcasters/etc. (see
 * src/lib/podcast-distribution.ts). Every PUBLISHED episode, newest first.
 *
 * `length` on each <enclosure> is honestly 0 when unknown — this platform
 * doesn't track uploaded-audio byte size (see PodcastEpisode's schema
 * comment on durationSec being staff-entered for the same reason), so
 * fabricating a length would be worse than a validator flagging the
 * omission.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const [podcast, episodes] = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    Promise.all([
      tx.podcast.findUnique({ where: { id } }),
      tx.podcastEpisode.findMany({
        where: { podcastId: id, status: "PUBLISHED", audioKey: { not: null } },
        orderBy: { publishedAt: "desc" },
      }),
    ])
  );
  if (!podcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rssEpisodes = await Promise.all(
    episodes.map(async (e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      audioUrl: await absoluteAssetUrl(e.audioKey!),
      audioBytes: null,
      durationSec: e.durationSec,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      publishedAt: e.publishedAt,
      canonicalUrl: `${APP_BASE_URL}/podcast/${podcast.id}?episode=${e.id}`,
    }))
  );

  const xml = buildPodcastRss({
    id: podcast.id,
    title: podcast.title,
    description: podcast.description,
    coverImageUrl: podcast.coverImageKey ? await absoluteAssetUrl(podcast.coverImageKey) : null,
    category: podcast.category,
    language: podcast.language,
    explicit: podcast.explicit,
    hostNames: (() => {
      try {
        const parsed = JSON.parse(podcast.hosts) as { name?: string }[];
        const names = parsed.map((h) => h.name).filter(Boolean);
        return names.length ? names.join("; ") : "the hosts";
      } catch {
        return "the hosts";
      }
    })(),
    canonicalUrl: `${APP_BASE_URL}/podcast/${podcast.id}`,
    feedUrl: `${APP_BASE_URL}/api/podcasts/${podcast.id}/rss.xml`,
    episodes: rssEpisodes,
  });

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
