/// <reference types="bun-types" />
/**
 * Tests for the Retraction Watch sync + per-article check
 * (src/lib/retraction-watch.ts). `fetch` is mocked with a small real CSV
 * snippet (same column shape as the actual Crossref-hosted dataset); xlsx
 * itself is the real library, not mocked, since CSV parsing is exactly
 * what needs verifying here.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let recordStore: any[] = [];
let metaStore: Record<string, any> = {};
let referenceRows: any[] = [];

const fakeDb = {
  retractionWatchRecord: {
    deleteMany: mock(async () => {
      recordStore = [];
      return { count: 0 };
    }),
    createMany: mock(async ({ data }: any) => {
      recordStore.push(...data);
      return { count: data.length };
    }),
    findMany: mock(async ({ where }: any) => {
      const dois: string[] = where.originalPaperDoi.in;
      return recordStore.filter((r) => dois.includes(r.originalPaperDoi));
    }),
  },
  retractionWatchSyncMeta: {
    findUnique: mock(async () => metaStore.singleton || null),
    upsert: mock(async ({ create, update }: any) => {
      metaStore.singleton = metaStore.singleton ? { ...metaStore.singleton, ...update } : { id: "singleton", ...create };
      return metaStore.singleton;
    }),
  },
  reference: {
    findMany: mock(async ({ where }: any) => referenceRows.filter((r) => r.articleId === where.articleId && r.doi)),
  },
};

mock.module("@/lib/db", () => ({ db: fakeDb }));

const { syncRetractionWatchDatabase, checkReferencesForRetractions } = await import("@/lib/retraction-watch");

const SAMPLE_CSV = `Record ID,Title,Subject,Institution,Journal,Publisher,Country,Author,URLS,ArticleType,RetractionDate,RetractionDOI,RetractionPubMedID,OriginalPaperDate,OriginalPaperDOI,OriginalPaperPubMedID,RetractionNature,Reason,Paywalled,Notes
1,"A Retracted Study, With a Comma",Biology,Some University,Journal of Examples,Example Press,USA,Jane Doe,,Research Article,1/15/2024 0:00,10.1234/retraction.1,,1/1/2020 0:00,10.1234/original.1,,Retraction,Data Fabrication;,No,
2,Another Retracted Paper,Chemistry,Another Uni,Journal of Chemistry,Example Press,UK,John Smith,,Research Article,2/1/2023 0:00,10.1234/retraction.2,,1/1/2019 0:00,10.1234/original.2,,Retraction,Plagiarism,No,
3,No DOI Row,Physics,Some Uni,Journal of Physics,Example Press,DE,A Person,,Research Article,3/1/2022 0:00,,,1/1/2018 0:00,,,Retraction,Unreliable Data,No,
`;

function resetAll() {
  recordStore = [];
  metaStore = {};
  referenceRows = [];
  globalThis.fetch = mock(async () => ({ ok: true, status: 200, text: async () => SAMPLE_CSV })) as any;
  for (const fn of Object.values(fakeDb.retractionWatchRecord)) (fn as any).mockClear?.();
  for (const fn of Object.values(fakeDb.retractionWatchSyncMeta)) (fn as any).mockClear?.();
  fakeDb.reference.findMany.mockClear();
}
beforeEach(resetAll);

describe("syncRetractionWatchDatabase", () => {
  test("parses the real CSV shape and skips rows with no resolvable DOI", async () => {
    const result = await syncRetractionWatchDatabase();
    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(2); // the third row has no OriginalPaperDOI
    expect(recordStore.some((r) => r.originalPaperDoi === "10.1234/original.1")).toBe(true);
    expect(metaStore.singleton.lastSyncedAt).toBeInstanceOf(Date);
    expect(metaStore.singleton.lastError).toBeNull();
  });

  test("records a real, disclosed error on fetch failure — never leaves stale data unflagged", async () => {
    globalThis.fetch = mock(async () => ({ ok: false, status: 503, text: async () => "" })) as any;
    const result = await syncRetractionWatchDatabase();
    expect(result.success).toBe(false);
    expect(result.error).toContain("503");
    expect(metaStore.singleton.lastError).toContain("503");
  });
});

describe("checkReferencesForRetractions", () => {
  test("everSynced is false before any sync has run", async () => {
    const result = await checkReferencesForRetractions("article-1");
    expect(result.everSynced).toBe(false);
    expect(result.flagged).toEqual([]);
  });

  test("flags a reference whose DOI matches a retracted paper, ignores clean ones", async () => {
    await syncRetractionWatchDatabase();
    referenceRows = [
      { id: "ref-1", articleId: "article-1", rawText: "Doe, J. (2020). A retracted study.", doi: "10.1234/original.1" },
      { id: "ref-2", articleId: "article-1", rawText: "Someone else, entirely clean.", doi: "10.9999/not-retracted" },
    ];

    const result = await checkReferencesForRetractions("article-1");
    expect(result.everSynced).toBe(true);
    expect(result.flagged.length).toBe(1);
    expect(result.flagged[0].referenceId).toBe("ref-1");
    expect(result.flagged[0].reason).toContain("Data Fabrication");
  });
});
