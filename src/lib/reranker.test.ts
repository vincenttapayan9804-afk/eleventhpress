import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rerank, rerankConfigured } from "./reranker";

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const saved = { url: process.env.RERANK_URL, key: process.env.RERANK_API_KEY, timeout: process.env.RERANK_TIMEOUT_MS };

beforeEach(() => {
  delete process.env.RERANK_URL;
  delete process.env.RERANK_API_KEY;
  delete process.env.RERANK_TIMEOUT_MS;
  console.warn = () => {};
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  for (const [k, v] of [["RERANK_URL", saved.url], ["RERANK_API_KEY", saved.key], ["RERANK_TIMEOUT_MS", saved.timeout]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("rerank", () => {
  test("does nothing without RERANK_URL", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("[]");
    }) as unknown as typeof fetch;
    expect(rerankConfigured()).toBe(false);
    expect(await rerank("q", ["a", "b"])).toBeNull();
    expect(called).toBe(false);
  });

  test("calls the text-embeddings-inference /rerank API and returns scores in input order", async () => {
    process.env.RERANK_URL = "http://reranker:8080/";
    process.env.RERANK_API_KEY = "k";
    let seen: { url: string; body: any; auth: string | null } | null = null;
    globalThis.fetch = (async (url: any, init: RequestInit) => {
      seen = { url: String(url), body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") };
      return Response.json([
        { index: 1, score: 0.9 },
        { index: 0, score: 0.2 },
      ]);
    }) as unknown as typeof fetch;
    expect(await rerank("what was found?", ["first", "second"])).toEqual([0.2, 0.9]);
    expect(seen!).toMatchObject({ url: "http://reranker:8080/rerank", auth: "Bearer k", body: { query: "what was found?", texts: ["first", "second"] } });
  });

  test("accepts a {results: [{index, relevance_score}]} reply", async () => {
    process.env.RERANK_URL = "http://reranker";
    globalThis.fetch = (async () => Response.json({ results: [{ index: 0, relevance_score: 0.5 }] })) as unknown as typeof fetch;
    expect(await rerank("q", ["a", "b"])).toEqual([0.5, Number.NEGATIVE_INFINITY]);
  });

  test("fails open: an error, bad reply or timeout returns null", async () => {
    process.env.RERANK_URL = "http://reranker";
    globalThis.fetch = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    expect(await rerank("q", ["a"])).toBeNull();
    globalThis.fetch = (async () => Response.json({ nope: true })) as unknown as typeof fetch;
    expect(await rerank("q", ["a"])).toBeNull();
    process.env.RERANK_TIMEOUT_MS = "30";
    globalThis.fetch = ((_u: any, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError"))))) as unknown as typeof fetch;
    expect(await rerank("q", ["a"])).toBeNull();
  });
});
