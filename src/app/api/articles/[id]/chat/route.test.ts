import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { NextRequest } from "next/server";

/**
 * POST /api/articles/[id]/chat ("Ask this paper") runs the same pipeline as
 * Ask the Corpus: inline citations resolved against the evidence, APA
 * sources, follow-up questions, a retry on a malformed reply, regenerate
 * from the same evidence, and a friendly banner for every operational
 * failure.
 *
 * Mocks delegate to the real module unless this file switched them on (bun
 * shares mock.module() across test files) and are switched off in afterAll.
 */
type LlmModule = typeof import("@/lib/llm");
type ChunksModule = typeof import("@/lib/chunk-embeddings");
type RateLimitModule = typeof import("@/lib/ratelimit");
type DbModule = typeof import("@/lib/db");
type RlsModule = typeof import("@/lib/db-rls");
type TenantModule = typeof import("@/lib/tenant");
const REAL = {
  llm: "../../../../../lib/llm.ts?real=article-chat-route-test",
  chunks: "../../../../../lib/chunk-embeddings.ts?real=article-chat-route-test",
  ratelimit: "../../../../../lib/ratelimit.ts?real=article-chat-route-test",
  db: "../../../../../lib/db.ts?real=article-chat-route-test",
  rls: "../../../../../lib/db-rls.ts?real=article-chat-route-test",
  tenant: "../../../../../lib/tenant.ts?real=article-chat-route-test",
};
const realLlm = (await import(REAL.llm)) as LlmModule;
const realChunks = (await import(REAL.chunks)) as ChunksModule;
const realRateLimit = (await import(REAL.ratelimit)) as RateLimitModule;
const realDb = (await import(REAL.db)) as DbModule;
const realRls = (await import(REAL.rls)) as RlsModule;
const realTenant = (await import(REAL.tenant)) as TenantModule;

let active = false;
let llmConfigured = true;
let chatReplies: unknown[] = [];
let chatCalls: { system: string; user: string; opts: any }[] = [];
let retrievalQueries: string[] = [];
let passages: unknown[] = [];
let evidenceLoads: string[][] = [];
let status = "PUBLISHED";

const RECORD = {
  id: "art_1",
  title: "Classroom Learning Environment and Institutional Support as Predictors of Motivated Strategies",
  authors: JSON.stringify([{ name: "Ana Rivera", affiliation: "University of Dhaka" }]),
  abstract: "We assess how the classroom environment predicts motivated learning strategies.",
  keywords: "learning environment, motivation",
  doi: "10.5555/ep.2026.001",
  publishedAt: new Date("2026-03-10T00:00:00Z"),
  discipline: "Education",
  issue: { volume: 2, issueNumber: 1 },
};

const P1 = { chunkId: "c1", chunkIndex: 3, score: 1, matchType: "lexical", text: "The study surveyed 412 senior high school students using the MSLQ." };
const P2 = { chunkId: "c2", chunkIndex: 0, score: 0.5, matchType: "vector", text: "Classroom learning environment significantly predicted motivated strategies (β = .41, p < .001)." };

mock.module("@/lib/llm", () => ({
  ...realLlm,
  anyLLMAvailable: () => (active ? llmConfigured : realLlm.anyLLMAvailable()),
  chatJSON: (async (...args: Parameters<LlmModule["chatJSON"]>) => {
    if (!active) return realLlm.chatJSON(...args);
    chatCalls.push({ system: args[0], user: args[1], opts: args[2] });
    const reply = chatReplies.length > 1 ? chatReplies.shift() : chatReplies[0];
    if (reply instanceof Error) throw reply;
    return { data: reply, rawResponse: "", model: "openrouter/free", provider: "oss-free" };
  }) as LlmModule["chatJSON"],
}));

mock.module("@/lib/chunk-embeddings", () => ({
  ...realChunks,
  retrieveChunks: (async (...args: Parameters<ChunksModule["retrieveChunks"]>) => {
    if (!active) return realChunks.retrieveChunks(...args);
    retrievalQueries.push(String(args[1]));
    return passages;
  }) as unknown as ChunksModule["retrieveChunks"],
  indexArticleChunks: (async (...args: Parameters<ChunksModule["indexArticleChunks"]>) =>
    active ? { chunkCount: 0 } : realChunks.indexArticleChunks(...args)) as unknown as ChunksModule["indexArticleChunks"],
  loadCorpusChunksByIds: (async (...args: Parameters<ChunksModule["loadCorpusChunksByIds"]>) => {
    if (!active) return realChunks.loadCorpusChunksByIds(...args);
    evidenceLoads.push(args[0]);
    return [
      { ...P2, articleId: "art_1", articleTitle: RECORD.title },
      { ...P1, chunkId: "other", articleId: "art_2", articleTitle: "Another paper" },
    ];
  }) as unknown as ChunksModule["loadCorpusChunksByIds"],
}));

mock.module("@/lib/ratelimit", () => ({
  ...realRateLimit,
  checkRateLimit: (async (...args: Parameters<RateLimitModule["checkRateLimit"]>) =>
    active ? { ok: true } : realRateLimit.checkRateLimit(...args)) as unknown as RateLimitModule["checkRateLimit"],
}));

mock.module("@/lib/tenant", () => ({
  ...realTenant,
  resolveTenantFromHeaders: ((headers: Headers) =>
    active ? Promise.resolve(null) : realTenant.resolveTenantFromHeaders(headers)) as TenantModule["resolveTenantFromHeaders"],
}));

mock.module("@/lib/db-rls", () => ({
  ...realRls,
  withTenantRlsContext: (async (tenantId: string | null, fn: (tx: any) => Promise<unknown>) =>
    active
      ? fn({ article: { findUnique: async () => ({ ...RECORD, status }) } })
      : realRls.withTenantRlsContext(tenantId, fn as any)) as unknown as RlsModule["withTenantRlsContext"],
}));

mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (active && prop === "journal") {
        return { findFirst: async () => ({ name: "Journal of Test Studies", issn: "1234-5678", publisher: "Test Press" }) };
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { POST } = await import("./route");

let ipCounter = 0;
function ask(question = "What method did the authors use, and what was the main finding?", extra: Record<string, unknown> = {}) {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/articles/art_1/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipCounter}` },
      body: JSON.stringify({ question, ...extra }),
    }),
    { params: Promise.resolve({ id: "art_1" }) }
  );
}

const quiet = { error: console.error, warn: console.warn, info: console.info };

beforeEach(() => {
  active = true;
  llmConfigured = true;
  status = "PUBLISHED";
  passages = [P1, P2];
  chatReplies = [
    {
      answer: "The authors surveyed 412 students with the MSLQ [P1]. The classroom environment predicted motivated strategies [P2].\n\n### References\nRivera (2026).",
      usedPassages: [1, 2],
      grounded: true,
      suggestedQuestions: ["How was the MSLQ adapted for the students in this study?"],
    },
  ];
  chatCalls = [];
  retrievalQueries = [];
  evidenceLoads = [];
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
});

afterAll(() => {
  active = false;
  Object.assign(console, quiet);
});

describe("POST /api/articles/[id]/chat", () => {
  test("answers with numbered citations, an APA source and follow-up questions", async () => {
    const body = await (await ask()).json();
    expect(body.mode).toBe("answered");
    expect(body.answer).toContain("[1]");
    expect(body.answer).toContain("[2]");
    expect(body.answer).not.toContain("[P1]");
    expect(body.answer).not.toMatch(/### References/);
    expect(body.citations).toHaveLength(2);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].id).toBe("art_1");
    expect(body.sources[0].reference).toContain("Journal of Test Studies");
    expect(body.evidence.passagesReviewed).toBe(2);
    expect(body.evidence.articlesReviewed).toBe(1);
    expect(body.evidenceIds).toEqual(["c1", "c2"]);
    expect(body.suggestedQuestions).toEqual(["How was the MSLQ adapted for the students in this study?"]);
    expect(Array.isArray(body.sectionQuestions)).toBe(true);
    expect(body.sectionArticleId).toBe("art_1");
    expect(body.model).toBe("openrouter/free");
  });

  test("the prompt scopes the model to this article and asks for cited, structured JSON", async () => {
    await ask();
    expect(chatCalls).toHaveLength(1);
    const { system, user, opts } = chatCalls[0];
    expect(system).toContain("Journal of Test Studies");
    expect(system).toContain(RECORD.title);
    expect(system).toContain("suggestedQuestions");
    expect(user).toContain("[A1]");
    expect(user).toContain("[P1]");
    expect(user).toContain("[P2]");
    expect(opts.priority).toBe("cost-first");
  });

  test("a malformed first reply is retried once", async () => {
    chatReplies = [{ usedPassages: [] }, { answer: "It used the MSLQ [P1].", usedPassages: [1], grounded: true }];
    const body = await (await ask()).json();
    expect(chatCalls).toHaveLength(2);
    expect(body.mode).toBe("answered");
    expect(body.answer).toBe("It used the MSLQ [1].");
  });

  test("a provider failure returns the friendly banner, never the raw error", async () => {
    chatReplies = [new Error('401 {"error":{"message":"invalid x-api-key"}}')];
    const body = await (await ask()).json();
    expect(body.mode).toBe("unavailable");
    expect(JSON.stringify(body)).not.toContain("x-api-key");
  });

  test("no configured provider returns the friendly banner", async () => {
    llmConfigured = false;
    const body = await (await ask()).json();
    expect(body.mode).toBe("unavailable");
    expect(chatCalls).toHaveLength(0);
  });

  test("regenerate reuses this article's evidence only", async () => {
    const body = await (await ask("What did they find?", { regenerate: true, evidenceIds: ["c2", "other"] })).json();
    expect(evidenceLoads).toEqual([["c2", "other"]]);
    expect(retrievalQueries).toHaveLength(0);
    expect(body.evidenceIds).toEqual(["c2"]);
    expect(chatCalls[0].opts.temperature).toBe(0.5);
    expect(chatCalls[0].user).toContain("regenerated answer");
  });

  test("a follow-up is retrieved together with the previous question", async () => {
    await ask("What were its limitations?", {
      history: [
        { role: "user", content: "What instrument measured motivation?" },
        { role: "assistant", content: "The MSLQ [1]." },
      ],
    });
    expect(retrievalQueries[0]).toContain("What were its limitations?");
    expect(retrievalQueries[0]).toContain("What instrument measured motivation?");
  });

  test("an article with no indexable text says so", async () => {
    passages = [];
    const body = await (await ask()).json();
    expect(body.mode).toBe("not-indexed");
  });

  test("an unpublished article is not found", async () => {
    status = "UNDER_REVIEW";
    const res = await ask();
    expect(res.status).toBe(404);
  });
});
