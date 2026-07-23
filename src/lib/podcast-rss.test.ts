/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildPodcastRss, type PodcastRssShow } from "@/lib/podcast-rss";

const SHOW: PodcastRssShow = {
  id: "podcast-1",
  title: "Corpus Callosum",
  description: "Conversations with researchers about work in progress.",
  coverImageUrl: "https://eleventhpress.vercel.app/covers/podcast-1.jpg",
  category: "Science & Medicine",
  language: "eng",
  explicit: false,
  hostNames: "Grace Hopper; Katherine Johnson",
  canonicalUrl: "https://eleventhpress.vercel.app/podcast/podcast-1",
  feedUrl: "https://eleventhpress.vercel.app/api/podcasts/podcast-1/rss.xml",
  episodes: [
    {
      id: "ep-1",
      title: "Fieldwork & Failure",
      description: "A conversation about negative results.",
      audioUrl: "https://eleventhpress.vercel.app/api/podcast-episodes/ep-1/audio",
      audioBytes: 10485760,
      durationSec: 1925,
      seasonNumber: 1,
      episodeNumber: 1,
      publishedAt: "2026-03-01T00:00:00.000Z",
      canonicalUrl: "https://eleventhpress.vercel.app/podcast/podcast-1?episode=ep-1",
    },
    {
      id: "ep-2",
      title: "Data & Its Discontents",
      description: "On messy datasets & clean papers.",
      audioUrl: "https://eleventhpress.vercel.app/api/podcast-episodes/ep-2/audio",
      audioBytes: null,
      durationSec: null,
      seasonNumber: null,
      episodeNumber: 2,
      publishedAt: null,
      canonicalUrl: "https://eleventhpress.vercel.app/podcast/podcast-1?episode=ep-2",
    },
  ],
};

describe("buildPodcastRss", () => {
  test("emits a valid RSS 2.0 document with the iTunes namespace declared", () => {
    const xml = buildPodcastRss(SHOW);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"');
    expect(xml).toContain("<title>Corpus Callosum</title>");
    expect(xml).toContain("<itunes:author>Grace Hopper; Katherine Johnson</itunes:author>");
    expect(xml).toContain('<itunes:category text="Science &amp; Medicine" />');
  });

  test("emits one <item> per episode with a stable-endpoint enclosure, never a raw storage key or presigned URL", () => {
    const xml = buildPodcastRss(SHOW);
    expect((xml.match(/<item>/g) || []).length).toBe(2);
    expect(xml).toContain('<enclosure url="https://eleventhpress.vercel.app/api/podcast-episodes/ep-1/audio" length="10485760" type="audio/mpeg" />');
    expect(xml).toContain('<enclosure url="https://eleventhpress.vercel.app/api/podcast-episodes/ep-2/audio" length="0" type="audio/mpeg" />');
  });

  test("emits itunes:duration as h:mm:ss (or m:ss under an hour) only when durationSec is known", () => {
    const xml = buildPodcastRss(SHOW);
    expect(xml).toContain("<itunes:duration>32:05</itunes:duration>"); // 1925s -> 32:05
    // ep-2 has no duration — its <item> block must not claim one.
    const ep2Block = xml.split("Data &amp; Its Discontents")[1] || "";
    expect(ep2Block.split("</item>")[0]).not.toContain("itunes:duration");
  });

  test("emits itunes:season only when seasonNumber is known", () => {
    const xml = buildPodcastRss(SHOW);
    expect(xml).toContain("<itunes:season>1</itunes:season>");
    const ep2Block = xml.split("Data &amp; Its Discontents")[1] || "";
    expect(ep2Block.split("</item>")[0]).not.toContain("itunes:season");
  });

  test("emits a self-referencing atom:link using the show's feedUrl", () => {
    const xml = buildPodcastRss(SHOW);
    expect(xml).toContain(`<atom:link href="${SHOW.feedUrl}" rel="self" type="application/rss+xml" />`);
  });

  test("omits itunes:image/image when the show has no cover", () => {
    const xml = buildPodcastRss({ ...SHOW, coverImageUrl: null });
    expect(xml).not.toContain("itunes:image");
  });

  test("a show with no episodes still produces a well-formed, item-less feed", () => {
    const xml = buildPodcastRss({ ...SHOW, episodes: [] });
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
