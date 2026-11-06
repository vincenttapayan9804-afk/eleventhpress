import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { NextRequest } from "next/server";

/**
 * POST /api/corpus-chat must never hand a reader a raw upstream error (for
 * example Anthropic's 401 `invalid x-api-key` JSON). Every operational
 * failure becomes the same friendly "unavailable" banner.
 *
 * bun's mock.module() registry is shared across test files, so each mock
 * delegates to the real module unless this file has switched it on, and is
 * switched off again in afterAll. Later files see the real behaviour.
 */
type LlmModule = typeof import("@/lib/llm");
type ChunksModule = typeof import("@/lib/chunk-embeddings");
type RateLimitModule = typeof import("@/lib/ratelimit");
// Query-string specifiers bypass any mock another file registered. They are
// held in variables so the type checker doesn't try to resolve them.
const REAL = {
  llm: "../../../lib/llm.ts?real=corpus-chat-route-test",
  chunks: "../../../lib/chunk-embeddings.ts?real=corpus-chat-route-test",
  ratelimit: "../../../lib/ratelimit.ts?real=corpus-chat-route-test",
};
const realLlm = (await import(REAL.llm)) as LlmModule;
const realChunks = (await import(REAL.chunks)) as ChunksModule;
const realRateLimit = (await import(REAL.ratelimit)) as RateLimitModule;

let active = false;
let llmConfigured = true;
let chatFailure: Error | null = null;
let retrievalFailure: Error | null = null;

const PASSAGE = {
  chunkIndex: 0,
  text: "Mangrove restoration reduced storm-surge damage by 30%.",
  matchType: "semantic",
  articleId: "art_1",
  articleTitle: "Coastal Adaptation in Practice",
};

mock.module("@/lib/llm", () => ({
  ...realLlm,
  anyLLMAvailable: () => (active ? llmConfigured : realLlm.anyLLMAvailable()),
  chatJSON: (async (...args: Parameters<LlmModule["chatJSON"]>) => {
    if (!active) return realLlm.chatJSON(...args);
    if (chatFailure) throw chatFailure;
    return { data: { answer: "Restoration cut damage by 30%.", usedPassages: [1], grounded: true }, rawResponse: "", model: "test-model", provider: "oss-free" };
  }) as LlmModule["chatJSON"],
}));

mock.module("@/lib/chunk-embeddings", () => ({
  ...realChunks,
  retrieveChunksAcrossCorpus: (async (...args: Parameters<ChunksModule["retrieveChunksAcrossCorpus"]>) => {
    if (!active) return realChunks.retrieveChunksAcrossCorpus(...args);
    if (retrievalFailure) throw retrievalFailure;
    return [PASSAGE];
  }) as unknown as ChunksModule["retrieveChunksAcrossCorpus"],
}));

// Rate limiting is covered by its own tests; other files mock it in ways
// that would make this route return 429 here.
mock.module("@/lib/ratelimit", () => ({
  ...realRateLimit,
  checkRateLimit: (async (...args: Parameters<RateLimitModule["checkRateLimit"]>) =>
    active ? { ok: true } : realRateLimit.checkRateLimit(...args)) as unknown as RateLimitModule["checkRateLimit"],
}));

const { POST } = await import("./route");

const RAW_ANTHROPIC_401 =
  '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cgkqxuocu1QutkjdeChzJ"}';

let ipCounter = 0;
function ask(question = "What have authors found about climate adaptation?") {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/corpus-chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${ipCounter}` },
      body: JSON.stringify({ question }),
    })
  );
}

const consoleError = console.error;
const consoleWarn = console.warn;

beforeEach(() => {
  active = true;
  llmConfigured = true;
  chatFailure = null;
  retrievalFailure = null;
  console.error = () => {};
  console.warn = () => {};
});

afterAll(() => {
  active = false;
  console.error = consoleError;
  console.warn = consoleWarn;
});

describe("POST /api/corpus-chat error handling", () => {
  test("a provider failure (e.g. an invalid API key) returns the friendly banner, not the raw error", async () => {
    chatFailure = new Error(RAW_ANTHROPIC_401);
    const res = await ask();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe("unavailable");
    expect(body.message).toMatch(/temporarily unavailable/);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("x-api-key");
    expect(serialized).not.toContain("req_011");
    expect(body.error).toBeUndefined();
  });

  test("a retrieval failure also returns the friendly banner", async () => {
    retrievalFailure = new Error("connect ECONNREFUSED 10.0.0.5:5432");
    const body = await (await ask()).json();
    expect(body.mode).toBe("unavailable");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  test("no configured provider returns the friendly banner without naming env vars", async () => {
    llmConfigured = false;
    const body = await (await ask()).json();
    expect(body.mode).toBe("unavailable");
    expect(body.message).toMatch(/temporarily unavailable/);
    expect(JSON.stringify(body)).not.toMatch(/API_KEY|LLM_BASE_URL/);
  });

  test("a successful answer still comes back with its citations", async () => {
    const body = await (await ask()).json();
    expect(body.mode).toBe("answered");
    expect(body.answer).toBe("Restoration cut damage by 30%.");
    expect(body.citedChunks).toHaveLength(1);
    expect(body.citedChunks[0].articleTitle).toBe(PASSAGE.articleTitle);
  });

  test("reader-facing validation errors are unchanged", async () => {
    const res = await ask("   ");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("question is required");
  });
});
