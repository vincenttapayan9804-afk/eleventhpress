import { describe, expect, test } from "bun:test";
import { BLOGS, GUIDES } from "@/lib/resources-content";
import { BLOG_POSTS } from "@/lib/resources/blog-posts";
import { GUIDE_DOCS } from "@/lib/resources/guide-docs";
import { blogPlainText, getBlogPost, getGuideDoc, guidePlainText, readMinutesFor, wordCount } from "@/lib/resources";
import { pdfSafe } from "@/lib/provenance-certificate-pdf";

describe("resources blog", () => {
  test("every catalog entry has full text and vice versa", () => {
    expect(Object.keys(BLOG_POSTS).sort()).toEqual(BLOGS.map((b) => b.id).sort());
    for (const b of BLOGS) expect(getBlogPost(b.slug)?.id).toBe(b.id);
  });

  test("slugs are unique and URL-safe", () => {
    const slugs = BLOGS.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  for (const b of BLOGS) {
    test(`${b.id}: top 10 takeaways, long-form body, FAQs, references, honest read time`, () => {
      const p = BLOG_POSTS[b.id];
      expect(p.keyTakeaways).toHaveLength(10);
      expect(p.sections.length).toBeGreaterThanOrEqual(5);
      expect(p.faqs.length).toBeGreaterThanOrEqual(4);
      expect(p.references.length).toBeGreaterThanOrEqual(4);
      const words = wordCount(blogPlainText(p));
      expect(words).toBeGreaterThan(1100);
      expect(Math.abs(readMinutesFor(blogPlainText(p)) - b.readMinutes)).toBeLessThanOrEqual(1);
      expect(p.metaDescription.length).toBeLessThanOrEqual(230);
      for (const g of p.relatedGuides) expect(GUIDES.some((x) => x.id === g)).toBe(true);
    });
  }
});

describe("resources guides", () => {
  test("every catalog entry has full text and vice versa", () => {
    expect(Object.keys(GUIDE_DOCS).sort()).toEqual(GUIDES.map((g) => g.id).sort());
    for (const g of GUIDES) expect(getGuideDoc(g.slug)?.id).toBe(g.id);
  });

  test("document codes are unique and sequential", () => {
    expect(GUIDES.map((g) => g.code)).toEqual(GUIDES.map((_, i) => `EP-G-${String(i + 1).padStart(2, "0")}`));
  });

  for (const g of GUIDES) {
    test(`${g.id}: standards, ten key points, checklist, FAQs`, () => {
      const d = GUIDE_DOCS[g.id];
      expect(d.keyPoints).toHaveLength(10);
      expect(d.standards.length).toBeGreaterThanOrEqual(4);
      for (const s of d.standards) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.application.length).toBeGreaterThan(20);
      }
      expect(d.sections.length).toBeGreaterThanOrEqual(5);
      expect(d.checklist.length).toBeGreaterThanOrEqual(5);
      expect(d.faqs.length).toBeGreaterThanOrEqual(4);
      for (const r of d.relatedGuides) expect(GUIDES.some((x) => x.id === r)).toBe(true);
    });

    test(`${g.id}: text survives the PDF's WinAnsi fonts unchanged`, () => {
      const text = guidePlainText(GUIDE_DOCS[g.id]) + g.title + g.summary + g.benchmarks.join(" ");
      expect(pdfSafe(text)).toBe(text.normalize("NFC"));
    });
  }
});
