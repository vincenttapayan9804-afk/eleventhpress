import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * bun's mock.module() registry is shared across test files, so the db mock
 * delegates to the real module unless this file has switched it on.
 */
type DbModule = typeof import("@/lib/db");
const REAL_DB = "./db.ts?real=source-signals-test";
const realDb = (await import(REAL_DB)) as DbModule;

let active = false;
let syncedAt: Date | null = new Date("2026-10-01T00:00:00Z");
let corrections: any[] = [];
let references: any[] = [];
let retractions: any[] = [];
let reviews: any[] = [];

mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (!active) return Reflect.get(target, prop, receiver);
      if (prop === "correction") return { findMany: async ({ where }: any) => corrections.filter((c) => where.articleId.in.includes(c.articleId)) };
      if (prop === "retractionWatchSyncMeta") return { findUnique: async () => (syncedAt ? { lastSyncedAt: syncedAt } : null) };
      if (prop === "reference") return { findMany: async ({ where }: any) => references.filter((r) => where.articleId.in.includes(r.articleId)) };
      if (prop === "retractionWatchRecord") return { findMany: async ({ where }: any) => retractions.filter((r) => where.originalPaperDoi.in.includes(r.originalPaperDoi)) };
      if (prop === "independentReview") return { findMany: async ({ where }: any) => reviews.filter((r) => where.articleId.in.includes(r.articleId)) };
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { __resetSourceSignalCacheForTests, correctionStatus, correctionWarnings, loadCorrections, loadSourceSignals } = await import("./source-signals");

const realFetch = globalThis.fetch;
const consoleError = console.error;
let openAlexCalls = 0;

beforeEach(() => {
  active = true;
  syncedAt = new Date("2026-10-01T00:00:00Z");
  corrections = [];
  references = [];
  retractions = [];
  reviews = [];
  openAlexCalls = 0;
  __resetSourceSignalCacheForTests();
  console.error = () => {};
  globalThis.fetch = (async (url: any) => {
    openAlexCalls++;
    if (String(url).includes("10.5555%2Fcited")) return Response.json({ id: "https://openalex.org/W42", cited_by_count: 17, publication_year: 2025 });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  active = false;
  globalThis.fetch = realFetch;
  console.error = consoleError;
});

describe("correction status and warnings", () => {
  test("the most serious notice wins", () => {
    expect(correctionStatus(["CORRIGENDUM", "RETRACTION"])).toBe("retracted");
    expect(correctionStatus(["ERRATUM", "EXPRESSION_OF_CONCERN"])).toBe("concern");
    expect(correctionStatus(["ERRATUM"])).toBe("corrected");
    expect(correctionStatus([])).toBeNull();
  });

  test("retractions and expressions of concern warn; corrigenda don't", async () => {
    corrections = [
      { articleId: "a1", type: "RETRACTION", title: "Retracted", doi: "10.1/r", issuedAt: new Date("2026-05-01T00:00:00Z") },
      { articleId: "a2", type: "EXPRESSION_OF_CONCERN", title: "Concern", doi: null, issuedAt: new Date("2026-05-02T00:00:00Z") },
      { articleId: "a3", type: "CORRIGENDUM", title: "Fixed table", doi: null, issuedAt: new Date("2026-05-03T00:00:00Z") },
    ];
    const notices = await loadCorrections(["a1", "a2", "a3"]);
    expect(notices.get("a1")![0]).toMatchObject({ label: "Retraction", issuedAt: "2026-05-01", doi: "10.1/r" });
    const warnings = correctionWarnings(
      [
        { n: 1, id: "a1" },
        { n: 2, id: "a2" },
        { n: 3, id: "a3" },
      ],
      notices
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/Source 1 has been retracted/);
    expect(warnings[1]).toMatch(/expression of concern about source 2/);
  });
});

describe("loadSourceSignals", () => {
  test("gathers corrections, retracted references, citation counts and reviews per article", async () => {
    corrections = [{ articleId: "a1", type: "ERRATUM", title: "Typo", doi: null, issuedAt: new Date("2026-04-01T00:00:00Z") }];
    references = [
      { articleId: "a1", doi: "10.9/Retracted" },
      { articleId: "a1", doi: "10.9/fine" },
    ];
    retractions = [{ originalPaperDoi: "10.9/retracted", originalTitle: "Bad paper", retractionDate: new Date("2025-01-02T00:00:00Z") }];
    reviews = [
      { articleId: "a1", channel: "HYPOTHESIS", externalUrl: "https://hyp.is/1", reviewerName: "R. One", postedAt: new Date("2026-02-01T00:00:00Z") },
      { articleId: "a2", channel: "PREREVIEW", externalUrl: "https://prereview.org/2", reviewerName: null, postedAt: null },
    ];
    const [a1, a2] = await loadSourceSignals([
      { id: "a1", doi: "10.5555/cited", anonymizedReviewHistory: true },
      { id: "a2", doi: null, anonymizedReviewHistory: false },
    ]);
    expect(a1.status).toBe("corrected");
    expect(a1.retractedReferences).toEqual([{ doi: "10.9/Retracted", title: "Bad paper", retractionDate: "2025-01-02" }]);
    expect(a1.citations).toEqual({ count: 17, url: "https://openalex.org/works?filter=cites:W42" });
    expect(a1.communityReviews).toMatchObject({ count: 1, items: [{ url: "https://hyp.is/1", reviewer: "R. One", postedAt: "2026-02-01" }] });
    // No DOI: no citation lookup. No public Review History: its reviews aren't shown.
    expect(a2.citations).toBeNull();
    expect(a2.communityReviews.count).toBe(0);
    expect(openAlexCalls).toBe(1);
  });

  test("an unsynced Retraction Watch mirror says nothing rather than 'none found'", async () => {
    syncedAt = null;
    const [a] = await loadSourceSignals([{ id: "a1", doi: null }]);
    expect(a.retractedReferences).toBeNull();
  });

  test("citation counts are cached, including works OpenAlex doesn't know", async () => {
    await loadSourceSignals([{ id: "a1", doi: "10.5555/cited" }, { id: "a2", doi: "10.5555/unknown" }]);
    const [, b] = await loadSourceSignals([{ id: "a1", doi: "https://doi.org/10.5555/CITED" }, { id: "a2", doi: "10.5555/unknown" }]);
    expect(b.citations).toBeNull();
    expect(openAlexCalls).toBe(2);
  });
});
