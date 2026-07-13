/// <reference types="bun-types" />
/**
 * Mocked-Prisma smoke tests for the pgvector migration. Verifies the
 * fail-open contract at the heart of this feature: any pgvector failure
 * (bootstrap, upsert, or query) must fall back to the exact pre-existing
 * JS-based behavior, never throw, never lose data already committed to the
 * canonical JSON-column store.
 *
 * Intercepts the `db` singleton via bun:test's mock.module BEFORE the
 * modules under test are imported (dynamic import below), since these
 * modules capture `db` at their own import time.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

type Call = { type: string; sql: string; values: any[] };
let calls: Call[] = [];
let queryRawQueue: any[][] = [];
let ddlShouldFail = false;
let queryShouldFail = false;

function nextQueryRawResult(): any[] {
  return queryRawQueue.length > 0 ? queryRawQueue.shift()! : [];
}

const fakeDb = {
  $queryRaw: mock(async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = strings.join("?");
    calls.push({ type: "$queryRaw", sql, values });
    if (queryShouldFail) throw new Error("mock $queryRaw failure");
    return nextQueryRawResult();
  }),
  $executeRaw: mock(async (strings: TemplateStringsArray, ...values: any[]) => {
    calls.push({ type: "$executeRaw", sql: strings.join("?"), values });
    if (ddlShouldFail) throw new Error("mock $executeRaw failure");
    return 1;
  }),
  $executeRawUnsafe: mock(async (sql: string) => {
    calls.push({ type: "$executeRawUnsafe", sql, values: [] });
    if (ddlShouldFail) throw new Error("mock $executeRawUnsafe failure");
    return 1;
  }),
  articleEmbedding: {
    findMany: mock(async () => [] as any[]),
    upsert: mock(async () => ({})),
  },
  article: {
    findUnique: mock(async () => null as any),
  },
};

mock.module("@/lib/db", () => ({ db: fakeDb }));

const { ensurePgvector, upsertVector, vectorLiteral, __resetPgvectorCacheForTests } = await import("@/lib/pgvector");
const { indexArticle, semanticSearch, generateEmbedding } = await import("@/lib/embeddings");
const { checkSimilarity } = await import("@/lib/manuscript-checks");

function resetAll() {
  calls = [];
  queryRawQueue = [];
  ddlShouldFail = false;
  queryShouldFail = false;
  fakeDb.$queryRaw.mockClear();
  fakeDb.$executeRaw.mockClear();
  fakeDb.$executeRawUnsafe.mockClear();
  fakeDb.articleEmbedding.findMany.mockClear();
  fakeDb.articleEmbedding.upsert.mockClear();
  fakeDb.article.findUnique.mockClear();
  __resetPgvectorCacheForTests();
}

beforeEach(resetAll);

describe("vectorLiteral", () => {
  test("formats a vector as pgvector's expected text literal", () => {
    expect(vectorLiteral([0.1, -0.2, 0.3])).toBe("[0.1,-0.2,0.3]");
    expect(vectorLiteral([])).toBe("[]");
  });
});

describe("ensurePgvector", () => {
  test("runs DDL when bootstrap objects don't exist yet, returns true", async () => {
    queryRawQueue.push([{ ready: false }]); // checkExists
    queryRawQueue.push([]); // backfill SELECT — nothing to backfill
    const result = await ensurePgvector();
    expect(result).toBe(true);
    const ddlCalls = calls.filter((c) => c.type === "$executeRawUnsafe");
    expect(ddlCalls.length).toBe(4);
    expect(ddlCalls[0].sql).toContain("CREATE SCHEMA");
    expect(ddlCalls[1].sql).toContain("CREATE EXTENSION");
    expect(ddlCalls[2].sql).toContain("CREATE TABLE");
    expect(ddlCalls[3].sql).toContain("hnsw");
  });

  test("skips DDL entirely when bootstrap objects already exist (cheap existence check)", async () => {
    queryRawQueue.push([{ ready: true }]); // checkExists
    queryRawQueue.push([]); // backfill SELECT
    const result = await ensurePgvector();
    expect(result).toBe(true);
    expect(calls.filter((c) => c.type === "$executeRawUnsafe").length).toBe(0);
  });

  test("concurrent calls within the same process share one bootstrap run (cached promise)", async () => {
    queryRawQueue.push([{ ready: false }]);
    queryRawQueue.push([]);
    const [a, b, c] = await Promise.all([ensurePgvector(), ensurePgvector(), ensurePgvector()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
    // checkExists ($queryRaw) should only have run once across all three calls.
    expect(calls.filter((c) => c.type === "$queryRaw").length).toBe(2); // checkExists + backfill
  });

  test("resolves false, never throws, when DDL fails", async () => {
    queryRawQueue.push([{ ready: false }]);
    ddlShouldFail = true;
    const result = await ensurePgvector();
    expect(result).toBe(false);
  });

  test("resolves false, never throws, when the existence check itself fails", async () => {
    queryShouldFail = true;
    const result = await ensurePgvector();
    expect(result).toBe(false);
  });
});

describe("indexArticle — dual-write with fail-open pgvector", () => {
  test("writes the canonical JSON column even when pgvector is unavailable", async () => {
    fakeDb.article.findUnique.mockImplementationOnce(async () => ({
      title: "Test Article",
      abstract: "An abstract.",
      keywords: "test, article",
      discipline: "Physics",
    }));
    queryShouldFail = true; // pgvector bootstrap fails
    await indexArticle("article-1");
    expect(fakeDb.articleEmbedding.upsert).toHaveBeenCalledTimes(1);
    // No vec.article_embedding upsert attempted since pgvector never became ready.
    const vecUpserts = calls.filter((c) => c.type === "$executeRaw" && c.sql.includes("vec.article_embedding"));
    expect(vecUpserts.length).toBe(0);
  });

  test("also writes to vec.article_embedding when pgvector is available", async () => {
    fakeDb.article.findUnique.mockImplementationOnce(async () => ({
      title: "Test Article",
      abstract: "An abstract.",
      keywords: "test, article",
      discipline: "Physics",
    }));
    queryRawQueue.push([{ ready: true }]); // checkExists
    queryRawQueue.push([]); // backfill
    await indexArticle("article-1");
    expect(fakeDb.articleEmbedding.upsert).toHaveBeenCalledTimes(1);
    const vecUpserts = calls.filter((c) => c.type === "$executeRaw" && c.sql.includes("vec.article_embedding"));
    expect(vecUpserts.length).toBe(1);
  });

  test("a failing vec upsert never affects the already-committed JSON write", async () => {
    fakeDb.article.findUnique.mockImplementationOnce(async () => ({
      title: "Test Article",
      abstract: "An abstract.",
      keywords: "test, article",
      discipline: "Physics",
    }));
    queryRawQueue.push([{ ready: true }]);
    queryRawQueue.push([]);
    // Let bootstrap succeed, then fail only the upsertVector's $executeRaw call.
    await ensurePgvector();
    ddlShouldFail = true; // upsertVector uses $executeRaw, not Unsafe — but our
    // fake shares the ddlShouldFail flag across both; that's fine here since
    // bootstrap already completed and won't run its DDL again.
    await expect(indexArticle("article-1")).resolves.toBeUndefined();
    expect(fakeDb.articleEmbedding.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("semanticSearch — pgvector path vs. fallback", () => {
  test("uses the SQL path when pgvector is available", async () => {
    queryRawQueue.push([{ ready: true }]); // checkExists
    queryRawQueue.push([]); // backfill
    queryRawQueue.push([{ articleId: "a1", score: 0.9 }]); // semanticSearch SELECT
    const results = await semanticSearch("test query", { limit: 5 });
    expect(results).toEqual([{ articleId: "a1", score: 0.9 }]);
    expect(fakeDb.articleEmbedding.findMany).not.toHaveBeenCalled();
  });

  test("falls through to the unchanged findMany scan when pgvector is unavailable", async () => {
    queryShouldFail = true;
    // Use the query's own embedding as the fixture, guaranteeing cosine
    // similarity 1.0 — avoids flakiness from an arbitrary fixture vector
    // whose similarity to a hashed-ngram query embedding isn't otherwise
    // guaranteed positive.
    const matchingVec = await generateEmbedding("test query");
    fakeDb.articleEmbedding.findMany.mockImplementationOnce(async () => [
      { articleId: "a1", embedding: JSON.stringify(matchingVec), article: { id: "a1", status: "PUBLISHED" } },
    ]);
    const results = await semanticSearch("test query", { threshold: 0.5 });
    expect(fakeDb.articleEmbedding.findMany).toHaveBeenCalledTimes(1);
    expect(results.length).toBe(1);
    expect(results[0].articleId).toBe("a1");
  });
});

describe("checkSimilarity — pgvector path vs. fallback", () => {
  test("uses the SQL path (with title) when pgvector is available", async () => {
    queryRawQueue.push([{ ready: true }]);
    queryRawQueue.push([]);
    queryRawQueue.push([{ articleId: "a1", title: "Existing Article", score: 0.8 }]);
    const result = await checkSimilarity("some manuscript text", "exclude-me");
    expect(result.matches).toEqual([{ articleId: "a1", title: "Existing Article", score: 80 }]);
    expect(fakeDb.articleEmbedding.findMany).not.toHaveBeenCalled();
  });

  test("falls through to the unchanged findMany scan when pgvector is unavailable", async () => {
    queryShouldFail = true;
    const matchingVec = await generateEmbedding("some manuscript text");
    fakeDb.articleEmbedding.findMany.mockImplementationOnce(async () => [
      {
        articleId: "a1",
        embedding: JSON.stringify(matchingVec),
        article: { id: "a1", title: "Existing Article" },
      },
    ]);
    const result = await checkSimilarity("some manuscript text");
    expect(fakeDb.articleEmbedding.findMany).toHaveBeenCalledTimes(1);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].title).toBe("Existing Article");
  });
});
