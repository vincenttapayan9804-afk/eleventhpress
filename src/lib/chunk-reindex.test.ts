import { describe, expect, test } from "bun:test";
import { CHUNKER_UPDATED_AT, reindexStaleChunks, staleArticlesWhere } from "./chunk-reindex";

function fakeDeps(ids: string[], failId = "") {
  const indexed: string[] = [];
  const calls: { cutoff: Date; take: number }[] = [];
  return {
    indexed,
    calls,
    deps: {
      findStale: async (cutoff: Date, take: number) => {
        calls.push({ cutoff, take });
        return ids.slice(0, take).map((id) => ({ id }));
      },
      index: async (id: string) => {
        if (id === failId) throw new Error("boom");
        indexed.push(id);
      },
    },
  };
}

describe("reindexStaleChunks", () => {
  test("stale means a published article with passages older than the splitter", () => {
    expect(staleArticlesWhere(CHUNKER_UPDATED_AT)).toEqual({ status: "PUBLISHED", chunks: { some: { createdAt: { lt: CHUNKER_UPDATED_AT } } } });
  });

  test("re-indexes every stale article", async () => {
    const f = fakeDeps(["a", "b"]);
    const r = await reindexStaleChunks({}, f.deps);
    expect(f.calls[0]).toEqual({ cutoff: CHUNKER_UPDATED_AT, take: 200 });
    expect(f.indexed).toEqual(["a", "b"]);
    expect(r).toEqual({ stale: 2, reindexed: 2, failed: 0, remaining: 0 });
  });

  test("one failing article doesn't stop the batch", async () => {
    const f = fakeDeps(["a", "bad", "c"], "bad");
    const r = await reindexStaleChunks({}, f.deps);
    expect(f.indexed).toEqual(["a", "c"]);
    expect(r.failed).toBe(1);
  });

  test("stops when the time budget runs out and reports what's left", async () => {
    const f = fakeDeps(["a", "b"]);
    expect(await reindexStaleChunks({ budgetMs: -1 }, f.deps)).toEqual({ stale: 2, reindexed: 0, failed: 0, remaining: 2 });
  });

  test("nothing stale: no work", async () => {
    expect(await reindexStaleChunks({}, fakeDeps([]).deps)).toEqual({ stale: 0, reindexed: 0, failed: 0, remaining: 0 });
  });
});
