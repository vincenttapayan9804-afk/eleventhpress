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
type DbModule = typeof import("@/lib/db");
// Query-string specifiers bypass any mock another file registered. They are
// held in variables so the type checker doesn't try to resolve them.
const REAL = {
  llm: "../../../lib/llm.ts?real=corpus-chat-route-test",
  chunks: "../../../lib/chunk-embeddings.ts?real=corpus-chat-route-test",
  ratelimit: "../../../lib/ratelimit.ts?real=corpus-chat-route-test",
  db: "../../../lib/db.ts?real=corpus-chat-route-test",
};
const realLlm = (await import(REAL.llm)) as LlmModule;
const realChunks = (await import(REAL.chunks)) as ChunksModule;
const realRateLimit = (await import(REAL.ratelimit)) as RateLimitModule;
const realDb = (await import(REAL.db)) as DbModule;

let active = false;
let llmConfigured = true;
let chatFailure: Error | null = null;
let retrievalFailure: Error | null = null;
/** Replies handed out by the chatJSON mock in order; the last repeats. */
let chatReplies: unknown[] = [];
let chatCalls: { system: string; user: string; opts: any }[] = [];
let retrievalQueries: string[] = [];

const RECORD = {
  id: "art_1",
  title: "Coastal Adaptation in Practice",
  authors: JSON.stringify([{ name: "Ana Rivera", affiliation: "University of Dhaka" }]),
  abstract: "We assess mangrove restoration as storm-surge protection.",
  keywords: "mangroves, storm surge",
  doi: "10.5555/ep.2026.001",
  publishedAt: new Date("2026-03-10T00:00:00Z"),
  discipline: "Environmental Science",
};

const PASSAGE = {
  chunkId: "c1",
  score: 1,
  focused: true,
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
    chatCalls.push({ system: args[0], user: args[1], opts: args[2] });
    if (chatFailure) throw chatFailure;
    const reply = chatReplies.length > 1 ? chatReplies.shift() : chatReplies[0];
    if (reply instanceof Error) throw reply;
    return { data: reply ?? { answer: "Restoration cut damage by 30%.", usedPassages: [1], grounded: true }, rawResponse: "", model: "test-model", provider: "oss-free" };
  }) as LlmModule["chatJSON"],
}));

mock.module("@/lib/chunk-embeddings", () => ({
  ...realChunks,
  retrieveChunksAcrossCorpus: (async (...args: Parameters<ChunksModule["retrieveChunksAcrossCorpus"]>) => {
    if (!active) return realChunks.retrieveChunksAcrossCorpus(...args);
    retrievalQueries.push(String(args[0]));
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

// Article records come from the database; serve a fixed record here.
mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (active && prop === "article") {
        return { findMany: async () => [RECORD] };
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { POST, GET } = await import("./route");

const RAW_ANTHROPIC_401 =
  '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cgkqxuocu1QutkjdeChzJ"}';

let ipCounter = 0;
function ask(question = "What have authors found about climate adaptation?", history?: { role: string; content: string }[]) {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/corpus-chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${ipCounter}` },
      body: JSON.stringify({ question, ...(history ? { history } : {}) }),
    })
  );
}

const consoleError = console.error;
const consoleWarn = console.warn;
const consoleInfo = console.info;

beforeEach(() => {
  active = true;
  llmConfigured = true;
  chatFailure = null;
  retrievalFailure = null;
  chatReplies = [];
  chatCalls = [];
  retrievalQueries = [];
  console.info = () => {};
  console.error = () => {};
  console.warn = () => {};
});

afterAll(() => {
  active = false;
  console.error = consoleError;
  console.warn = consoleWarn;
  console.info = consoleInfo;
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

describe("POST /api/corpus-chat grounding", () => {
  test("the model gets the article record, the passages and the grounding rules, at low temperature", async () => {
    await ask("Who wrote the coastal adaptation paper?");
    expect(chatCalls).toHaveLength(1);
    const { system, user, opts } = chatCalls[0];
    expect(system).toContain("ONLY the journal records");
    expect(system).toMatch(/exactly as written/);
    expect(user).toContain('[A1] "Coastal Adaptation in Practice"');
    expect(user).toContain("Authors: Ana Rivera (University of Dhaka)");
    expect(user).toContain("Published: 2026-03-10");
    expect(user).toContain("DOI: 10.5555/ep.2026.001");
    expect(user).toContain("[Passage 1 | A1");
    expect(user).toContain(PASSAGE.text);
    expect(user).toContain('The reader appears to be asking about: "Coastal Adaptation in Practice"');
    expect(opts.temperature).toBeLessThanOrEqual(0.2);
  });

  test("a follow-up question is retrieved together with the previous question", async () => {
    await ask("What were its limitations?", [
      { role: "user", content: "Tell me about the mangrove restoration study" },
      { role: "assistant", content: "It found less damage." },
    ]);
    expect(retrievalQueries[0]).toContain("What were its limitations?");
    expect(retrievalQueries[0]).toContain("mangrove restoration study");
  });

  test("an answer drawn only from the article record still cites the named article", async () => {
    chatReplies = [{ answer: "Ana Rivera wrote it.", usedPassages: [], grounded: true }];
    const body = await (await ask("Who wrote the coastal adaptation paper?")).json();
    expect(body.mode).toBe("answered");
    expect(body.citedChunks).toHaveLength(1);
    expect(body.citedChunks[0].articleTitle).toBe(PASSAGE.articleTitle);
  });

  test("a malformed first reply is retried once", async () => {
    chatReplies = [new Error("LLM response did not contain a JSON object"), { answer: "Second try.", usedPassages: [1], grounded: true }];
    const body = await (await ask()).json();
    expect(chatCalls).toHaveLength(2);
    expect(body.mode).toBe("answered");
    expect(body.answer).toBe("Second try.");
  });

  test("invalid passage numbers from the model are ignored", async () => {
    chatReplies = [{ answer: "x", usedPassages: [1, 1, 99, "abc", -2], grounded: true }];
    const body = await (await ask()).json();
    expect(body.citedChunks).toHaveLength(1);
  });
});

describe("suggested questions", () => {
  test("an answer comes with specific follow-ups and a chip for every section of the paper", async () => {
    chatReplies = [
      {
        answer: "It found less damage.",
        usedPassages: [1],
        grounded: true,
        suggestedQuestions: ["How was storm-surge damage measured in Coastal Adaptation in Practice?", "", 7],
      },
    ];
    const body = await (await ask("Tell me about the coastal adaptation paper")).json();
    expect(body.suggestedQuestions).toEqual(["How was storm-surge damage measured in Coastal Adaptation in Practice?"]);
    expect(body.sectionArticle).toBe("Coastal Adaptation in Practice");
    const sections = body.sectionQuestions.map((s: { section: string }) => s.section);
    for (const s of ["Problem", "Background", "Research gap", "Research questions", "Hypotheses", "Respondents", "Research design", "Instruments", "Results"]) {
      expect(sections).toContain(s);
    }
    expect(body.sectionQuestions[0].question).toBe("What problem does “Coastal Adaptation in Practice” address?");
  });

  test("the model is asked for content-specific follow-ups across the paper's sections", async () => {
    await ask();
    expect(chatCalls[0].system).toContain('"suggestedQuestions"');
    expect(chatCalls[0].system).toMatch(/Research gap, Research questions, Hypotheses/);
    expect(chatCalls[0].system).toMatch(/answerable from these records/);
  });

  test("sections the reader already asked about are not offered again", async () => {
    const body = await (await ask("What hypotheses did the coastal adaptation paper test?")).json();
    const sections = body.sectionQuestions.map((s: { section: string }) => s.section);
    expect(sections).not.toContain("Hypotheses");
    expect(sections).toContain("Results");
  });

  test("a section question searches with that section's vocabulary", async () => {
    await ask("Who were the respondents or participants in “Coastal Adaptation in Practice”, and how were they selected?");
    expect(retrievalQueries[0]).toMatch(/purposive/);
  });

  test("GET returns starter questions about recent articles", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.suggestedQuestions).toEqual(["What problem does “Coastal Adaptation in Practice” address?"]);
  });
});
