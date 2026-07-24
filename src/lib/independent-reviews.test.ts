/// <reference types="bun-types" />
/**
 * Tests for the Independent Review Network sync + read path
 * (src/lib/independent-reviews.ts). `fetch` is mocked with a shape matching
 * Hypothes.is's real, documented search API response
 * (https://h.readthedocs.io/en/latest/api-reference/).
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let reviewStore: any[] = [];
let syncStateStore: Record<string, any> = {};

function stateKey(articleId: string, channel: string) {
  return `${articleId}::${channel}`;
}

const fakeDb = {
  independentReview: {
    upsert: mock(async ({ where, create, update }: any) => {
      const key = `${where.articleId_channel_externalId.articleId}::${where.articleId_channel_externalId.channel}::${where.articleId_channel_externalId.externalId}`;
      const existingIndex = reviewStore.findIndex((r) => r.__key === key);
      if (existingIndex >= 0) {
        reviewStore[existingIndex] = { ...reviewStore[existingIndex], ...update };
      } else {
        reviewStore.push({ __key: key, id: key, ...create });
      }
      return reviewStore.find((r) => r.__key === key);
    }),
    findMany: mock(async ({ where }: any) => reviewStore.filter((r) => r.articleId === where.articleId)),
  },
  independentReviewSyncState: {
    findUnique: mock(async ({ where }: any) => {
      const k = stateKey(where.articleId_channel.articleId, where.articleId_channel.channel);
      return syncStateStore[k] || null;
    }),
    upsert: mock(async ({ where, create, update }: any) => {
      const k = stateKey(where.articleId_channel.articleId, where.articleId_channel.channel);
      syncStateStore[k] = syncStateStore[k] ? { ...syncStateStore[k], ...update } : { id: k, ...create };
      return syncStateStore[k];
    }),
  },
};

mock.module("@/lib/db", () => ({ db: fakeDb }));

const {
  fetchHypothesisAnnotations,
  syncIndependentReviewsForArticle,
  getIndependentReviewsForArticle,
} = await import("@/lib/independent-reviews");

const SAMPLE_HYPOTHESIS_RESPONSE = {
  total: 2,
  rows: [
    {
      id: "annotation-1",
      uri: "https://eleventhpress.vercel.app/article/article-1",
      text: "This claim in section 3 is well-supported by the cited data.",
      created: "2026-06-01T12:00:00.000Z",
      user: "acct:jane_reviewer@hypothes.is",
      links: { html: "https://hypothes.is/a/annotation-1", incontext: "https://hyp.is/annotation-1/example" },
    },
    {
      id: "annotation-2",
      uri: "https://eleventhpress.vercel.app/article/article-1",
      text: "Anonymous note without a resolvable username.",
      created: "2026-06-02T08:00:00.000Z",
      user: undefined,
      links: {},
    },
  ],
};

function resetAll() {
  reviewStore = [];
  syncStateStore = {};
  globalThis.fetch = mock(async () => ({
    ok: true,
    status: 200,
    json: async () => SAMPLE_HYPOTHESIS_RESPONSE,
  })) as any;
  fakeDb.independentReview.upsert.mockClear();
  fakeDb.independentReview.findMany.mockClear();
  fakeDb.independentReviewSyncState.findUnique.mockClear();
  fakeDb.independentReviewSyncState.upsert.mockClear();
}
beforeEach(resetAll);

describe("fetchHypothesisAnnotations", () => {
  test("parses the real Hypothes.is search response shape", async () => {
    const results = await fetchHypothesisAnnotations("https://eleventhpress.vercel.app/article/article-1");
    expect(results.length).toBe(2);
    expect(results[0].externalId).toBe("annotation-1");
    expect(results[0].externalUrl).toBe("https://hyp.is/annotation-1/example");
    expect(results[0].reviewerName).toBe("jane_reviewer");
    expect(results[0].postedAt).toBeInstanceOf(Date);
  });

  test("falls back to a constructed URL and null reviewer when links/user are absent", async () => {
    const results = await fetchHypothesisAnnotations("https://eleventhpress.vercel.app/article/article-1");
    expect(results[1].externalUrl).toBe("https://hypothes.is/a/annotation-2");
    expect(results[1].reviewerName).toBeNull();
  });

  test("throws on a non-OK response — caller is responsible for failing open", async () => {
    globalThis.fetch = mock(async () => ({ ok: false, status: 403 })) as any;
    await expect(fetchHypothesisAnnotations("https://example.com/x")).rejects.toThrow("403");
  });
});

describe("syncIndependentReviewsForArticle", () => {
  test("upserts fetched annotations and records a clean sync state", async () => {
    const result = await syncIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(reviewStore.length).toBe(2);
    expect(syncStateStore["article-1::HYPOTHESIS"].lastError).toBeNull();
  });

  test("re-syncing the same article upserts in place rather than duplicating", async () => {
    await syncIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    await syncIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    expect(reviewStore.length).toBe(2);
  });

  test("fails open on a network error — records the real error, never throws", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("blocked by sandbox egress policy: CONNECT tunnel failed, response 403");
    }) as any;
    const result = await syncIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("403");
    expect(syncStateStore["article-1::HYPOTHESIS"].lastError).toContain("403");
    expect(reviewStore.length).toBe(0);
  });
});

describe("getIndependentReviewsForArticle", () => {
  test("triggers a sync when no prior check exists, then returns the stored rows", async () => {
    const results = await getIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    expect(results.length).toBe(2);
    expect(results[0].channelLabel).toBe("Hypothes.is");
  });

  test("does not re-fetch when the last check is fresh (within the staleness window)", async () => {
    await getIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    const fetchCallsAfterFirst = (globalThis.fetch as any).mock.calls.length;
    await getIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    expect((globalThis.fetch as any).mock.calls.length).toBe(fetchCallsAfterFirst);
  });

  test("re-fetches once the last check is older than the staleness window", async () => {
    await getIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    syncStateStore["article-1::HYPOTHESIS"].lastCheckedAt = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const fetchCallsBefore = (globalThis.fetch as any).mock.calls.length;
    await getIndependentReviewsForArticle("article-1", "https://eleventhpress.vercel.app/article/article-1");
    expect((globalThis.fetch as any).mock.calls.length).toBe(fetchCallsBefore + 1);
  });

  test("returns an empty array (never throws) when the article has never been checked and the fetch fails", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("network unreachable");
    }) as any;
    const results = await getIndependentReviewsForArticle("article-2", "https://eleventhpress.vercel.app/article/article-2");
    expect(results).toEqual([]);
  });
});
