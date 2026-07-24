/// <reference types="bun-types" />
/**
 * Tests for the Independent Review Network sync + read path
 * (src/lib/independent-reviews.ts). `fetch` is mocked with response shapes
 * matching each channel's real, documented API:
 *  - Hypothes.is: https://h.readthedocs.io/en/latest/api-reference/
 *  - PREreview: field names confirmed from github.com/PREreview/rapid-prereview;
 *    the wrapper shape is a best guess (see module docstring) — this sample
 *    uses a bare array, one of the shapes the parser accepts.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let reviewStore: any[] = [];
let syncStateStore: Record<string, any> = {};

function stateKey(articleId: string, channel: string) {
  return `${articleId}::${channel}`;
}

let curatedIdCounter = 0;

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
    create: mock(async ({ data }: any) => {
      const id = `curated-${++curatedIdCounter}`;
      const row = { id, ...data };
      reviewStore.push(row);
      return row;
    }),
    findUnique: mock(async ({ where }: any) => reviewStore.find((r) => r.id === where.id) || null),
    delete: mock(async ({ where }: any) => {
      const index = reviewStore.findIndex((r) => r.id === where.id);
      if (index >= 0) reviewStore.splice(index, 1);
    }),
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
  fetchPrereviewRapidReviews,
  syncIndependentReviewsForArticle,
  getIndependentReviewsForArticle,
  addEditorCuratedReview,
  deleteEditorCuratedReview,
  listIndependentReviewsForAdmin,
  EDITOR_CURATED_CHANNELS,
} = await import("@/lib/independent-reviews");

const ARTICLE_URL = "https://eleventhpress.vercel.app/article/article-1";
const ARTICLE_DOI = "10.52011/epip.2024.001";

const SAMPLE_HYPOTHESIS_RESPONSE = {
  total: 2,
  rows: [
    {
      id: "annotation-1",
      uri: ARTICLE_URL,
      text: "This claim in section 3 is well-supported by the cited data.",
      created: "2026-06-01T12:00:00.000Z",
      user: "acct:jane_reviewer@hypothes.is",
      links: { html: "https://hypothes.is/a/annotation-1", incontext: "https://hyp.is/annotation-1/example" },
    },
    {
      id: "annotation-2",
      uri: ARTICLE_URL,
      text: "Anonymous note without a resolvable username.",
      created: "2026-06-02T08:00:00.000Z",
      user: undefined,
      links: {},
    },
  ],
};

const SAMPLE_PREREVIEW_RESPONSE = [
  {
    id: "rapid-1",
    created: "2026-05-01T00:00:00.000Z",
    authorHandle: "orange-tiger",
    ynNovel: "yes",
    ynMethod: "yes",
    ynRecommend: "yes",
    ynEthics: "N/A",
  },
];

function mockFetchByHost(handlers: { hypothesis?: any; prereview?: any; throwOn?: string }) {
  globalThis.fetch = mock(async (url: string) => {
    if (handlers.throwOn && url.includes(handlers.throwOn)) {
      throw new Error("blocked by sandbox egress policy: CONNECT tunnel failed, response 403");
    }
    if (url.includes("hypothes.is")) {
      return handlers.hypothesis ?? { ok: true, status: 200, json: async () => SAMPLE_HYPOTHESIS_RESPONSE };
    }
    if (url.includes("prereview.org")) {
      return handlers.prereview ?? { ok: true, status: 200, json: async () => SAMPLE_PREREVIEW_RESPONSE };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }) as any;
}

function resetAll() {
  reviewStore = [];
  syncStateStore = {};
  curatedIdCounter = 0;
  mockFetchByHost({});
  fakeDb.independentReview.upsert.mockClear();
  fakeDb.independentReview.findMany.mockClear();
  fakeDb.independentReview.create.mockClear();
  fakeDb.independentReview.findUnique.mockClear();
  fakeDb.independentReview.delete.mockClear();
  fakeDb.independentReviewSyncState.findUnique.mockClear();
  fakeDb.independentReviewSyncState.upsert.mockClear();
}
beforeEach(resetAll);

describe("fetchHypothesisAnnotations", () => {
  test("parses the real Hypothes.is search response shape", async () => {
    const results = await fetchHypothesisAnnotations(ARTICLE_URL);
    expect(results.length).toBe(2);
    expect(results[0].externalId).toBe("annotation-1");
    expect(results[0].externalUrl).toBe("https://hyp.is/annotation-1/example");
    expect(results[0].reviewerName).toBe("jane_reviewer");
    expect(results[0].postedAt).toBeInstanceOf(Date);
  });

  test("falls back to a constructed URL and null reviewer when links/user are absent", async () => {
    const results = await fetchHypothesisAnnotations(ARTICLE_URL);
    expect(results[1].externalUrl).toBe("https://hypothes.is/a/annotation-2");
    expect(results[1].reviewerName).toBeNull();
  });

  test("throws on a non-OK response — caller is responsible for failing open", async () => {
    mockFetchByHost({ hypothesis: { ok: false, status: 403 } });
    await expect(fetchHypothesisAnnotations(ARTICLE_URL)).rejects.toThrow("403");
  });
});

describe("fetchPrereviewRapidReviews", () => {
  test("parses the confirmed rapid-review yn* fields into a summary + recommendation", async () => {
    const results = await fetchPrereviewRapidReviews(ARTICLE_DOI);
    expect(results.length).toBe(1);
    expect(results[0].externalId).toBe("rapid-1");
    expect(results[0].reviewerName).toBe("orange-tiger");
    expect(results[0].recommendation).toBe("yes");
    expect(results[0].excerpt).toContain("Novel: yes");
    expect(results[0].excerpt).toContain("Methods appropriate: yes");
    expect(results[0].postedAt).toBeInstanceOf(Date);
  });

  test("builds the doi-<slug> path segment by replacing slashes", async () => {
    await fetchPrereviewRapidReviews(ARTICLE_DOI);
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("doi-10.52011-epip.2024.001");
  });

  test("falls back to a derived stable id when the response has none", async () => {
    mockFetchByHost({ prereview: { ok: true, status: 200, json: async () => [{ ynRecommend: "no" }] } });
    const results = await fetchPrereviewRapidReviews(ARTICLE_DOI);
    expect(results[0].externalId).toBeTruthy();
    expect(results[0].recommendation).toBe("no");
  });

  test("returns an empty array for an unrecognized wrapper shape rather than throwing", async () => {
    mockFetchByHost({ prereview: { ok: true, status: 200, json: async () => ({ somethingElse: true }) } });
    const results = await fetchPrereviewRapidReviews(ARTICLE_DOI);
    expect(results).toEqual([]);
  });

  test("throws on a non-OK response — caller is responsible for failing open", async () => {
    mockFetchByHost({ prereview: { ok: false, status: 404 } });
    await expect(fetchPrereviewRapidReviews(ARTICLE_DOI)).rejects.toThrow("404");
  });
});

describe("syncIndependentReviewsForArticle", () => {
  test("upserts fetched Hypothes.is annotations and records a clean sync state", async () => {
    const result = await syncIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null }, "HYPOTHESIS");
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(reviewStore.length).toBe(2);
    expect(syncStateStore["article-1::HYPOTHESIS"].lastError).toBeNull();
  });

  test("upserts fetched PREreview rapid reviews and records a clean sync state", async () => {
    const result = await syncIndependentReviewsForArticle(
      "article-1",
      { canonicalUrl: ARTICLE_URL, doi: ARTICLE_DOI },
      "PREREVIEW"
    );
    expect(result.success).toBe(true);
    expect(result.synced).toBe(1);
    expect(reviewStore[0].recommendation).toBe("yes");
    expect(syncStateStore["article-1::PREREVIEW"].lastError).toBeNull();
  });

  test("skips PREreview entirely (0 synced, no error) when the article has no DOI", async () => {
    const result = await syncIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null }, "PREREVIEW");
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  test("re-syncing the same article upserts in place rather than duplicating", async () => {
    await syncIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null }, "HYPOTHESIS");
    await syncIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null }, "HYPOTHESIS");
    expect(reviewStore.length).toBe(2);
  });

  test("fails open on a network error — records the real error, never throws", async () => {
    mockFetchByHost({ throwOn: "hypothes.is" });
    const result = await syncIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null }, "HYPOTHESIS");
    expect(result.success).toBe(false);
    expect(result.error).toContain("403");
    expect(syncStateStore["article-1::HYPOTHESIS"].lastError).toContain("403");
    expect(reviewStore.length).toBe(0);
  });
});

describe("getIndependentReviewsForArticle", () => {
  test("checks only Hypothes.is when the article has no DOI", async () => {
    const results = await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null });
    expect(results.length).toBe(2);
    expect(syncStateStore["article-1::PREREVIEW"]).toBeUndefined();
  });

  test("checks both channels when the article has a DOI", async () => {
    const results = await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: ARTICLE_DOI });
    expect(results.length).toBe(3); // 2 Hypothes.is + 1 PREreview
    const channels = results.map((r) => r.channel).sort();
    expect(channels).toEqual(["HYPOTHESIS", "HYPOTHESIS", "PREREVIEW"]);
    expect(results.find((r) => r.channel === "PREREVIEW")?.channelLabel).toBe("PREreview");
  });

  test("does not re-fetch when the last check is fresh (within the staleness window)", async () => {
    await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null });
    const fetchCallsAfterFirst = (globalThis.fetch as any).mock.calls.length;
    await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null });
    expect((globalThis.fetch as any).mock.calls.length).toBe(fetchCallsAfterFirst);
  });

  test("re-fetches once the last check is older than the staleness window", async () => {
    await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null });
    syncStateStore["article-1::HYPOTHESIS"].lastCheckedAt = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const fetchCallsBefore = (globalThis.fetch as any).mock.calls.length;
    await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null });
    expect((globalThis.fetch as any).mock.calls.length).toBe(fetchCallsBefore + 1);
  });

  test("returns an empty array (never throws) when the article has never been checked and the fetch fails", async () => {
    mockFetchByHost({ throwOn: "hypothes.is" });
    const results = await getIndependentReviewsForArticle("article-2", { canonicalUrl: "https://eleventhpress.vercel.app/article/article-2", doi: null });
    expect(results).toEqual([]);
  });

  test("never auto-syncs editor-curated channels (PCI/Sciety/SciPost/OpenReview)", async () => {
    await getIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: ARTICLE_DOI });
    for (const channel of EDITOR_CURATED_CHANNELS) {
      expect(syncStateStore[`article-1::${channel}`]).toBeUndefined();
    }
  });
});

describe("addEditorCuratedReview / deleteEditorCuratedReview / listIndependentReviewsForAdmin", () => {
  test("adds a curated link for an editor-curated channel with sourceType EDITOR_ENTERED", async () => {
    const review = await addEditorCuratedReview("article-1", {
      channel: "SCIPOST",
      externalUrl: "https://scipost.org/submissions/example/",
      reviewerName: "Dr. Reviewer",
      excerpt: "A thorough refereeing report.",
      recommendation: "accept",
    });
    expect(review.channel).toBe("SCIPOST");
    expect(review.sourceType).toBe("EDITOR_ENTERED");
    expect(review.channelLabel).toBe("SciPost");
    expect(reviewStore.length).toBe(1);
  });

  test("rejects a channel that isn't editor-curated (e.g. HYPOTHESIS)", async () => {
    await expect(
      addEditorCuratedReview("article-1", { channel: "HYPOTHESIS", externalUrl: "https://hypothes.is/a/x" })
    ).rejects.toThrow("not an editor-curated channel");
  });

  test("rejects a malformed or non-http(s) URL", async () => {
    await expect(
      addEditorCuratedReview("article-1", { channel: "PCI", externalUrl: "not-a-url" })
    ).rejects.toThrow();
    await expect(
      addEditorCuratedReview("article-1", { channel: "PCI", externalUrl: "ftp://example.com/x" })
    ).rejects.toThrow("http or https");
  });

  test("listIndependentReviewsForAdmin returns stored rows without triggering any fetch", async () => {
    await addEditorCuratedReview("article-1", { channel: "OPENREVIEW", externalUrl: "https://openreview.net/forum?id=abc" });
    const fetchCallsBefore = (globalThis.fetch as any).mock.calls.length;
    const rows = await listIndependentReviewsForAdmin("article-1");
    expect(rows.length).toBe(1);
    expect((globalThis.fetch as any).mock.calls.length).toBe(fetchCallsBefore);
  });

  test("deleteEditorCuratedReview removes an editor-entered row", async () => {
    const review = await addEditorCuratedReview("article-1", { channel: "SCIETY", externalUrl: "https://sciety.org/articles/x" });
    await deleteEditorCuratedReview("article-1", review.id);
    expect(reviewStore.length).toBe(0);
  });

  test("deleteEditorCuratedReview refuses to remove an AUTOMATED row", async () => {
    await syncIndependentReviewsForArticle("article-1", { canonicalUrl: ARTICLE_URL, doi: null }, "HYPOTHESIS");
    const automatedId = reviewStore[0].id;
    await expect(deleteEditorCuratedReview("article-1", automatedId)).rejects.toThrow(
      "Only editor-entered reviews can be removed"
    );
    expect(reviewStore.length).toBe(2);
  });

  test("deleteEditorCuratedReview refuses a review belonging to a different article", async () => {
    const review = await addEditorCuratedReview("article-1", { channel: "PCI", externalUrl: "https://peercommunityin.org/x" });
    await expect(deleteEditorCuratedReview("article-2", review.id)).rejects.toThrow("not found");
  });
});
