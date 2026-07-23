/**
 * Podcast RSS 2.0 + iTunes-namespace feed — the file every real podcast
 * directory (Apple Podcasts, Spotify, Amazon Music, YouTube Music, and any
 * standard podcast app) actually ingests. There's no bulk "publish" API for
 * any of them (see src/lib/podcast-distribution.ts's docstring) — a
 * directory is fed by validating this URL once in that platform's own
 * onboarding form, after which every future episode just needs to appear
 * in the feed to reach every subscriber. This module only ever builds the
 * feed string; it has no network calls of its own.
 *
 * Element/attribute choices cross-checked against Apple's published
 * "Podcasts Connect" RSS feed requirements and the (community-maintained,
 * but Apple/Google/Spotify-aligned) podcast-namespace spec during this
 * change — same "well-sourced best effort, not against-the-real-spec
 * verified" caveat src/lib/onix.ts's docstring documents, since this
 * sandbox has no outbound network access to fetch either spec directly.
 * Validate a live feed with a real feed validator (e.g. Cast Feed
 * Validator, or a target directory's own feed-preview tool) before a first
 * submission.
 *
 * Enclosure URLs are never a raw storage key or a presigned URL (those
 * expire) — callers must resolve each episode's audioUrl to this app's own
 * stable /api/podcast-episodes/[id]/audio redirect endpoint first, so a
 * long-cached feed always keeps working.
 */
const ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";

export interface PodcastRssEpisode {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  audioBytes?: number | null;
  durationSec?: number | null;
  seasonNumber?: number | null;
  episodeNumber: number;
  publishedAt: Date | string | null;
  canonicalUrl: string;
}

export interface PodcastRssShow {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  category: string;
  language: string; // ISO 639-2/B, e.g. "eng"
  explicit: boolean;
  hostNames: string; // "Name; Name"
  canonicalUrl: string;
  feedUrl: string;
  episodes: PodcastRssEpisode[];
}

function rfc2822(d: Date): string {
  return d.toUTCString();
}

function durationHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function buildItemXml(ep: PodcastRssEpisode): string {
  const pubDate = ep.publishedAt ? new Date(ep.publishedAt) : new Date();
  const durationXml = ep.durationSec ? `\n      <itunes:duration>${durationHms(ep.durationSec)}</itunes:duration>` : "";
  const seasonXml = ep.seasonNumber ? `\n      <itunes:season>${ep.seasonNumber}</itunes:season>` : "";

  return `    <item>
      <title>${esc(ep.title)}</title>
      <description>${esc(ep.description)}</description>
      <link>${esc(ep.canonicalUrl)}</link>
      <guid isPermaLink="false">${esc(ep.id)}</guid>
      <pubDate>${rfc2822(pubDate)}</pubDate>
      <enclosure url="${esc(ep.audioUrl)}" length="${ep.audioBytes ?? 0}" type="audio/mpeg" />
      <itunes:episode>${ep.episodeNumber}</itunes:episode>${seasonXml}
      <itunes:episodeType>full</itunes:episodeType>${durationXml}
      <itunes:explicit>false</itunes:explicit>
    </item>`;
}

/** Builds a per-show RSS 2.0 + iTunes-namespace feed from its published episodes. */
export function buildPodcastRss(show: PodcastRssShow): string {
  const items = show.episodes.map(buildItemXml).join("\n");
  const imageXml = show.coverImageUrl
    ? `\n    <itunes:image href="${esc(show.coverImageUrl)}" />\n    <image>\n      <url>${esc(show.coverImageUrl)}</url>\n      <title>${esc(show.title)}</title>\n      <link>${esc(show.canonicalUrl)}</link>\n    </image>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="${ITUNES_NS}" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(show.title)}</title>
    <description>${esc(show.description)}</description>
    <link>${esc(show.canonicalUrl)}</link>
    <language>${esc(show.language)}</language>
    <atom:link href="${esc(show.feedUrl)}" rel="self" type="application/rss+xml" />
    <itunes:author>${esc(show.hostNames)}</itunes:author>
    <itunes:explicit>${show.explicit ? "true" : "false"}</itunes:explicit>
    <itunes:category text="${esc(show.category)}" />${imageXml}
    <itunes:owner>
      <itunes:name>${esc(show.hostNames)}</itunes:name>
    </itunes:owner>
${items}
  </channel>
</rss>`;
}
