import type { ContentSection, Faq, Reference } from "@/lib/resources/types";

/**
 * A newsroom story or long-form blog post in the Media section, written by
 * the editorial team and shipped with the code (src/lib/media/stories.ts).
 *
 * Citation markers such as [1] or [2][3] in any paragraph, bullet, key point
 * or FAQ answer refer to `references` by 1-based position. The page turns
 * them into links to the reference list, and every reference links out to
 * its source.
 */
export interface MediaStory {
  /** URL segment: /media/<slug>. */
  slug: string;
  type: "NEWS" | "BLOG";
  title: string;
  /** One-sentence standfirst under the headline. */
  dek: string;
  /** 140–160 characters, for search results. */
  metaDescription: string;
  keywords: string[];
  category: string;
  /** ISO dates. */
  datePublished: string;
  dateModified: string;
  /** Answer-first summary: the passage answer engines quote. */
  lede: string;
  /** "Key facts" for news (5–6), "Top 10 key takeaways" for blogs (exactly 10). */
  keyPoints: string[];
  sections: ContentSection[];
  faqs: Faq[];
  references: Reference[];
  /** Cover graphic: an original data card, generated at /media/<slug>/cover. */
  cover: {
    /** The headline number, e.g. "3.1%". */
    stat: string;
    /** What the number measures, e.g. "Global growth forecast, 2026". */
    statLabel: string;
    /** Who the number comes from, e.g. "IMF, October 2026". */
    source: string;
    /** Gradient hue (OKLCH-ish degrees) so covers differ across the grid. */
    hue: number;
    /** Plain-language description of the graphic for screen readers. */
    alt: string;
  };
}
