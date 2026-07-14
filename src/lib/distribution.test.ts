/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildShareKit, buildSubmissionPackage, buildBloggerPost, guessArxivCategory, getPlatform, PLATFORMS } from "@/lib/distribution";

const ARTICLE = {
  id: "art-1",
  title: "On the Distribution of Prime Gaps",
  abstract: "We study the statistical distribution of gaps between consecutive primes.",
  authors: JSON.stringify([
    { name: "Ada Lovelace", affiliation: "Analytical Engine Institute" },
    { name: "Alan Turing", affiliation: "Bletchley Park" },
  ]),
  discipline: "Mathematics",
  keywords: "primes, number theory",
  doi: "10.5281/zenodo.123456",
  journalName: "Eleventh Press Journal of Mathematics",
};

describe("PLATFORMS / getPlatform", () => {
  test("Tier C platforms have no consent requirement or submit URL", () => {
    for (const p of PLATFORMS.filter((p) => p.tier === "C")) {
      expect(p.consentText).toBeUndefined();
      expect(p.submitUrl).toBeUndefined();
    }
  });

  test("Tier B platforms (arXiv, SSRN) require consent and have a submit URL", () => {
    const tierB = PLATFORMS.filter((p) => p.tier === "B");
    expect(tierB.map((p) => p.id).sort()).toEqual(["ARXIV", "SSRN"]);
    for (const p of tierB) {
      expect(p.consentText).toBeTruthy();
      expect(p.submitUrl).toBeTruthy();
    }
  });

  test("getPlatform resolves a known id and returns undefined for an unknown one", () => {
    expect(getPlatform("RESEARCHGATE")?.label).toBe("ResearchGate");
    expect(getPlatform("ARXIV")?.tier).toBe("B");
    expect(getPlatform("NOT_A_PLATFORM")).toBeUndefined();
  });

  test("Blogger is the only Tier A platform, with no consent requirement or submit URL", () => {
    const tierA = PLATFORMS.filter((p) => p.tier === "A");
    expect(tierA.map((p) => p.id)).toEqual(["BLOGGER"]);
    expect(tierA[0].consentText).toBeUndefined();
    expect(tierA[0].submitUrl).toBeUndefined();
  });
});

describe("guessArxivCategory", () => {
  test("maps a known discipline case-insensitively", () => {
    expect(guessArxivCategory("Mathematics")).toBe("math.GM");
    expect(guessArxivCategory("physics")).toBe("physics.gen-ph");
  });

  test("returns null for an unmapped discipline", () => {
    expect(guessArxivCategory("Underwater Basket Weaving")).toBeNull();
  });
});

describe("buildSubmissionPackage", () => {
  test("includes title, formatted authors with affiliations, abstract, and the article's DOI in the comment", () => {
    const pkg = buildSubmissionPackage(ARTICLE, "ARXIV");
    expect(pkg.title).toBe(ARTICLE.title);
    expect(pkg.authors).toBe("Ada Lovelace (Analytical Engine Institute); Alan Turing (Bletchley Park)");
    expect(pkg.abstract).toBe(ARTICLE.abstract);
    expect(pkg.comment).toContain(ARTICLE.doi);
    expect(pkg.comment).toContain(ARTICLE.journalName);
  });

  test("suggests an arXiv category only for the ARXIV platform, not SSRN", () => {
    expect(buildSubmissionPackage(ARTICLE, "ARXIV").suggestedCategory).toBe("math.GM");
    expect(buildSubmissionPackage(ARTICLE, "SSRN").suggestedCategory).toBeNull();
  });

  test("falls back to discipline as keywords when the article has none", () => {
    const pkg = buildSubmissionPackage({ ...ARTICLE, keywords: undefined }, "ARXIV");
    expect(pkg.keywords).toBe(ARTICLE.discipline);
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

describe("buildBloggerPost", () => {
  test("includes the title verbatim and an HTML body with author names, journal, and a link back to the article", () => {
    const post = buildBloggerPost(ARTICLE);
    expect(post.title).toBe(ARTICLE.title);
    expect(post.html).toContain("Ada Lovelace");
    expect(post.html).toContain("Alan Turing");
    expect(post.html).toContain(ARTICLE.journalName);
    expect(post.html).toContain(`href="https://eleventhpress.vercel.app/article/${ARTICLE.id}"`);
  });

  test("prefers the lay summary over the raw abstract when available", () => {
    const post = buildBloggerPost({ ...ARTICLE, laySummary: "Prime gaps get rarer, but never disappear." });
    expect(post.html).toContain("Prime gaps get rarer, but never disappear.");
    expect(post.html).not.toContain(ARTICLE.abstract);
  });

  test("HTML-escapes author names and journal name", () => {
    const post = buildBloggerPost({
      ...ARTICLE,
      authors: JSON.stringify([{ name: "A & B <Labs>" }]),
      journalName: 'Journal "Quotes" & Co',
    });
    expect(post.html).toContain("A &amp; B &lt;Labs&gt;");
    expect(post.html).toContain("Journal &quot;Quotes&quot; &amp; Co");
    expect(post.html).not.toContain("<Labs>");
  });
});
