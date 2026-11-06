/**
 * Shapes for the long-form Resources content (blog posts and official
 * guides). The full text lives in server-only modules (blog-posts.ts,
 * guide-docs.ts) rendered by the crawlable /resources/... pages and the guide
 * PDF route; the client Resources view only imports the lightweight catalog
 * in src/lib/resources-content.ts.
 */

export interface ContentSection {
  heading: string;
  paragraphs: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
  /** Optional closing paragraph rendered after the bullets. */
  after?: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Reference {
  /** Full reference in APA 7th edition style. */
  text: string;
  url?: string;
}

export interface BlogPost {
  id: string;
  /** Answer-first summary (40–80 words) shown under the title: the passage
   * answer engines quote. */
  lede: string;
  metaDescription: string;
  keywords: string[];
  /** Exactly ten — the "Top 10 key takeaways" list. */
  keyTakeaways: string[];
  sections: ContentSection[];
  faqs: Faq[];
  references: Reference[];
  /** Guide ids worth reading next. */
  relatedGuides: string[];
}

export interface BenchmarkStandard {
  /** Short name, e.g. "COPE Core Practices". */
  name: string;
  /** Issuing body. */
  issuer: string;
  /** Edition / version / year we benchmark against. */
  edition: string;
  url: string;
  /** How this guide applies it. */
  application: string;
}

export interface GuideDoc {
  id: string;
  audience: string;
  purpose: string;
  scope: string;
  metaDescription: string;
  keywords: string[];
  /** "At a glance" — the ten requirements that matter most. */
  keyPoints: string[];
  standards: BenchmarkStandard[];
  sections: ContentSection[];
  checklist: string[];
  faqs: Faq[];
  relatedGuides: string[];
}
