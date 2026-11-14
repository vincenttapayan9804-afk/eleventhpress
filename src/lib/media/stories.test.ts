import { describe, expect, it } from "bun:test";
import { MEDIA_STORIES, getMediaStory, mediaReadMinutes, mediaStoryListItem, stripCitations } from "@/lib/media/stories";

const CITE = /\[(\d+)\]/g;

function allText(s: (typeof MEDIA_STORIES)[number]): string[] {
  return [
    s.lede,
    ...s.keyPoints,
    ...s.sections.flatMap((sec) => [...sec.paragraphs, ...(sec.bullets ?? []), sec.after ?? ""]),
    ...s.faqs.map((f) => f.a),
  ];
}

describe("media stories", () => {
  it("ships ten news stories and five long-form blogs with unique slugs", () => {
    expect(MEDIA_STORIES.filter((s) => s.type === "NEWS")).toHaveLength(10);
    expect(MEDIA_STORIES.filter((s) => s.type === "BLOG")).toHaveLength(5);
    expect(new Set(MEDIA_STORIES.map((s) => s.slug)).size).toBe(MEDIA_STORIES.length);
    for (const s of MEDIA_STORIES) expect(s.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("gives every blog exactly ten takeaways and every story FAQs and sources", () => {
    for (const s of MEDIA_STORIES) {
      if (s.type === "BLOG") expect(s.keyPoints).toHaveLength(10);
      else expect(s.keyPoints.length).toBeGreaterThanOrEqual(5);
      expect(s.faqs.length).toBeGreaterThanOrEqual(3);
      expect(s.references.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("only cites references that exist, and cites every reference", () => {
    for (const s of MEDIA_STORIES) {
      const cited = new Set<number>();
      for (const t of allText(s)) for (const m of t.matchAll(CITE)) cited.add(Number(m[1]));
      for (const n of cited) expect(n >= 1 && n <= s.references.length, `${s.slug} cites [${n}]`).toBe(true);
      for (let n = 1; n <= s.references.length; n++) expect(cited.has(n), `${s.slug} never cites [${n}]`).toBe(true);
    }
  });

  it("links every reference to an https source", () => {
    for (const s of MEDIA_STORIES) for (const r of s.references) expect(r.url ?? "").toMatch(/^https:\/\/[^\s]+$/);
  });

  it("keeps search snippets within limits and reading times plausible", () => {
    for (const s of MEDIA_STORIES) {
      expect(s.metaDescription.length, s.slug).toBeLessThanOrEqual(170);
      expect(s.metaDescription.length, s.slug).toBeGreaterThanOrEqual(110);
      expect(s.cover.alt.length).toBeGreaterThan(20);
      const min = mediaReadMinutes(s);
      if (s.type === "BLOG") expect(min, s.slug).toBeGreaterThanOrEqual(6);
      else expect(min, s.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("strips citation markers for plain text", () => {
    expect(stripCitations("Deaths fell 4% [3]. Funding rose [1][3].")).toBe("Deaths fell 4%. Funding rose.");
  });

  it("lists stories as published posts that link to their own pages", () => {
    const s = getMediaStory("who-global-tuberculosis-report-2026-key-findings")!;
    const item = mediaStoryListItem(s);
    expect(item.href).toBe("/media/who-global-tuberculosis-report-2026-key-findings");
    expect(item.heroImageUrl).toBe("/media/who-global-tuberculosis-report-2026-key-findings/cover");
    expect(item.status).toBe("PUBLISHED");
  });
});
