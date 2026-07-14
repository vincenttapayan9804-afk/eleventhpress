/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildShareKit, getPlatform, PLATFORMS } from "@/lib/distribution";

const ARTICLE = {
  id: "art-1",
  title: "On the Distribution of Prime Gaps",
  abstract: "We study the statistical distribution of gaps between consecutive primes.",
  authors: JSON.stringify([
    { name: "Ada Lovelace", affiliation: "Analytical Engine Institute" },
    { name: "Alan Turing", affiliation: "Bletchley Park" },
  ]),
  discipline: "Mathematics",
  journalName: "Eleventh Press Journal of Mathematics",
};

describe("PLATFORMS / getPlatform", () => {
  test("every Phase 1 platform is Tier C", () => {
    for (const p of PLATFORMS) expect(p.tier).toBe("C");
  });

  test("getPlatform resolves a known id and returns undefined for an unknown one", () => {
    expect(getPlatform("RESEARCHGATE")?.label).toBe("ResearchGate");
    expect(getPlatform("NOT_A_PLATFORM")).toBeUndefined();
  });
});

describe("buildShareKit", () => {
  test("includes the title, all author names, and a canonical link derived from the article id", () => {
    const kit = buildShareKit(ARTICLE);
    expect(kit.blurb).toContain(ARTICLE.title);
    expect(kit.blurb).toContain("Ada Lovelace");
    expect(kit.blurb).toContain("Alan Turing");
    expect(kit.canonicalUrl.endsWith(`/article/${ARTICLE.id}`)).toBe(true);
    expect(kit.blurb).toContain(kit.canonicalUrl);
    expect(kit.excerpt).toContain(kit.canonicalUrl);
  });

  test("prefers the AI lay summary over the raw abstract when available", () => {
    const withSummary = buildShareKit({ ...ARTICLE, laySummary: "Prime gaps get rarer, but never disappear." });
    expect(withSummary.blurb).toContain("Prime gaps get rarer, but never disappear.");
    expect(withSummary.blurb).not.toContain(ARTICLE.abstract);
  });

  test("falls back to the abstract when no lay summary exists", () => {
    const kit = buildShareKit(ARTICLE);
    expect(kit.blurb).toContain(ARTICLE.abstract);
  });

  test("falls back to 'the authors' when the authors JSON has no usable names", () => {
    const kit = buildShareKit({ ...ARTICLE, authors: "[]" });
    expect(kit.blurb).toContain("By the authors");
  });
});
