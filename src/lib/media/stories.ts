import { NEWS } from "@/lib/media/news";
import { MEDIA_BLOGS } from "@/lib/media/blogs";
import type { MediaStory } from "@/lib/media/types";

/**
 * Editorial stories shipped with the code: ten newsroom pieces and five
 * long-form blog posts. They are listed on the platform's Media page next to
 * posts written in the dashboard (MediaPost rows) and each has its own
 * server-rendered page at /media/<slug>. Whitelabel tenant sites don't show
 * them — they're the platform newsroom's own journalism.
 */
export const MEDIA_STORIES: MediaStory[] = [...NEWS, ...MEDIA_BLOGS];

const BY_SLUG = new Map(MEDIA_STORIES.map((s) => [s.slug, s]));

export function getMediaStory(slug: string): MediaStory | undefined {
  return BY_SLUG.get(slug);
}

export function mediaStoryPath(s: Pick<MediaStory, "slug">): string {
  return `/media/${s.slug}`;
}

export function mediaCoverPath(s: Pick<MediaStory, "slug">): string {
  return `/media/${s.slug}/cover`;
}

/** Citation markers like "[1]" or "[2][3]" removed — for meta tags, JSON-LD and word counts. */
export function stripCitations(text: string): string {
  return text.replace(/\s*(?:\[\d+\])+/g, "").replace(/\s+([.,;:])/g, "$1");
}

/** All readable text of a story, citations removed. */
export function mediaStoryPlainText(s: MediaStory): string {
  return stripCitations(
    [
      s.title,
      s.dek,
      s.lede,
      ...s.keyPoints,
      ...s.sections.flatMap((sec) => [sec.heading, ...sec.paragraphs, ...(sec.bullets ?? []), sec.after ?? ""]),
      ...s.faqs.flatMap((f) => [f.q, f.a]),
    ].join(" ")
  );
}

export function mediaWordCount(s: MediaStory): number {
  return mediaStoryPlainText(s).split(/\s+/).filter(Boolean).length;
}

/** Reading time at 230 words a minute, at least one minute. */
export function mediaReadMinutes(s: MediaStory): number {
  return Math.max(1, Math.round(mediaWordCount(s) / 230));
}

/** Shape the Media list (GET /api/media) returns, matching MediaPost rows plus a link. */
export function mediaStoryListItem(s: MediaStory) {
  return {
    id: s.slug,
    type: s.type,
    title: s.title,
    dek: s.dek,
    authorName: s.type === "NEWS" ? "Newsroom" : "Editorial Office",
    category: s.category,
    tags: s.keywords.join(", "),
    heroImageUrl: mediaCoverPath(s),
    href: mediaStoryPath(s),
    publishedAt: `${s.datePublished}T09:00:00.000Z`,
    status: "PUBLISHED",
    editorial: true,
  };
}
