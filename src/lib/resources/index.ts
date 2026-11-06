import { APP_BASE_URL, JOURNAL_IDENTITY } from "@/lib/site";
import { BLOGS, GUIDES, type Reading, type Guide } from "@/lib/resources-content";
import { BLOG_POSTS } from "@/lib/resources/blog-posts";
import { GUIDE_DOCS } from "@/lib/resources/guide-docs";
import type { BlogPost, GuideDoc, ContentSection } from "@/lib/resources/types";

export type FullBlogPost = Reading & BlogPost;
export type FullGuide = Guide & GuideDoc;

/** Blog post by URL slug, catalog fields merged with full text. */
export function getBlogPost(slug: string): FullBlogPost | null {
  const meta = BLOGS.find((b) => b.slug === slug);
  const body = meta ? BLOG_POSTS[meta.id] : undefined;
  return meta && body ? { ...meta, ...body } : null;
}

/** Guide by URL slug, catalog fields merged with full text. */
export function getGuideDoc(slug: string): FullGuide | null {
  const meta = GUIDES.find((g) => g.slug === slug);
  const body = meta ? GUIDE_DOCS[meta.id] : undefined;
  return meta && body ? { ...meta, ...body } : null;
}

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}

export const blogPath = (b: Pick<Reading, "slug">) => `/resources/blog/${b.slug}`;
export const guidePath = (g: Pick<Guide, "slug">) => `/resources/guides/${g.slug}`;
export const guidePdfPath = (g: Pick<Guide, "slug">) => `/resources/guides/${g.slug}/pdf`;

function sectionText(s: ContentSection): string {
  return [s.heading, ...s.paragraphs, ...(s.bullets ?? []), s.after ?? ""].join(" ");
}

/** Every word a reader reads in a blog post (for read-time estimates). */
export function blogPlainText(p: BlogPost): string {
  return [p.lede, ...p.keyTakeaways, ...p.sections.map(sectionText), ...p.faqs.flatMap((f) => [f.q, f.a])].join(" ");
}

export function guidePlainText(g: GuideDoc): string {
  return [
    g.purpose,
    g.scope,
    ...g.keyPoints,
    ...g.standards.flatMap((s) => [s.name, s.issuer, s.edition, s.application]),
    ...g.sections.map(sectionText),
    ...g.checklist,
    ...g.faqs.flatMap((f) => [f.q, f.a]),
  ].join(" ");
}

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Minutes at 230 words per minute, rounded. */
export const readMinutesFor = (text: string) => Math.max(1, Math.round(wordCount(text) / 230));

/** "6 November 2026" from an ISO date. */
export function fmtLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** APA-style citation for a guide (printed on the web page and the PDF). */
export function guideCitation(g: Guide): string {
  return `${JOURNAL_IDENTITY.name}. (${g.effective.slice(0, 4)}). ${g.title} (${g.code}, Version ${g.version}). ${APP_BASE_URL}${guidePath(g)}`;
}
