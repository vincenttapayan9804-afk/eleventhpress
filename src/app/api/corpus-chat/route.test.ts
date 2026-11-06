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
let retrievalCalls: { query: string; limit: unknown; options: any }[] = [];
let evidenceLoads: string[][] = [];

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
    retrievalCalls.push({ query: String(args[0]), limit: args[1], options: args[2] });
    if (retrievalFailure) throw retrievalFailure;
    return [PASSAGE];
  }) as unknown as ChunksModule["retrieveChunksAcrossCorpus"],
  loadCorpusChunksByIds: (async (...args: Parameters<ChunksModule["loadCorpusChunksByIds"]>) => {
    if (!active) return realChunks.loadCorpusChunksByIds(...args);
    evidenceLoads.push(args[0]);
    return [{ ...PASSAGE, focused: undefined }];
  }) as unknown as ChunksModule["loadCorpusChunksByIds"],
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
        return { findMany: async () => [RECORD], count: async () => 1 };
      }
      if (active && prop === "journal") {
        return { findFirst: async () => ({ name: "Journal of Test Studies", issn: "1234-5678", publisher: "Test Press" }) };
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { POST, GET } = await import("./route");

const RAW_ANTHROPIC_401 =
  '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cgkqxuocu1QutkjdeChzJ"}';

let ipCounter = 0;
function ask(
  question = "What have authors found about climate adaptation?",
  history?: { role: string; content: string; sources?: string[] }[],
  extra: Record<string, unknown> = {}
) {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/corpus-chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${ipCounter}` },
      body: JSON.stringify({ question, ...(history ? { history } : {}), ...extra }),
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
  retrievalCalls = [];
  evidenceLoads = [];
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
    expect(body.citations).toHaveLength(1);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].title).toBe(PASSAGE.articleTitle);
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
    expect(system).toContain("Journal of Test Studies");
    expect(system).toMatch(/exactly as written/);
    expect(user).toContain('[A1] "Coastal Adaptation in Practice"');
    expect(user).toContain("Authors: Ana Rivera (University of Dhaka)");
    expect(user).toContain("Published: 2026-03-10");
    expect(user).toContain("DOI: 10.5555/ep.2026.001");
    expect(user).toContain("[P1 | A1");
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
    expect(body.citations).toHaveLength(1);
    expect(body.sources[0].title).toBe(PASSAGE.articleTitle);
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
    expect(body.citations).toHaveLength(1);
  });
});

describe("POST /api/corpus-chat citation integrity", () => {
  test("inline [P1]/[A1] markers become numbered citations with verified sources", async () => {
    chatReplies = [{ answer: "Restoration cut damage by 30% [P1]. It was written by Ana Rivera [A1].", usedPassages: [1], grounded: true }];
    const body = await (await ask("Who wrote the coastal adaptation paper and what did it find?")).json();
    expect(body.answer).toBe("Restoration cut damage by 30% [1]. It was written by Ana Rivera [2].");
    expect(body.citations.map((c: any) => [c.n, c.kind])).toEqual([
      [1, "passage"],
      [2, "record"],
    ]);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].reference).toBe(
      "Rivera, A. (2026). Coastal Adaptation in Practice. Journal of Test Studies. https://doi.org/10.5555/ep.2026.001"
    );
    expect(body.sources[0].authors).toEqual([{ name: "Ana Rivera", affiliation: "University of Dhaka" }]);
    expect(body.evidence.status).toBe("verified");
    expect(body.evidenceIds).toEqual(["c1"]);
  });

  test("citations to evidence the model wasn't given, invented DOIs and its own reference list are removed", async () => {
    chatReplies = [
      {
        answer: "Damage fell by 30% [P1][P9] (doi:10.9999/fake.123).\n\n### References\nMadeUp, A. (2020). Not real.",
        usedPassages: [1],
        grounded: true,
      },
    ];
    const body = await (await ask()).json();
    expect(body.answer).not.toContain("References");
    expect(body.answer).not.toContain("10.9999/fake.123");
    expect(body.answer).toContain("[1]");
    expect(body.citations).toHaveLength(1);
    expect(body.evidence.status).toBe("review");
    expect(body.evidence.warnings.join(" ")).toMatch(/citation that pointed at evidence/);
    expect(body.evidence.warnings.join(" ")).toMatch(/DOI/);
  });

  test("the system prompt sets the knowledge boundary, academic standards and response structure", async () => {
    await ask();
    const { system } = chatCalls[0];
    expect(system).toMatch(/Never fabricate research findings, authors, article titles, publication dates, DOIs, statistical results/);
    expect(system).toMatch(/correlation as causation/);
    expect(system).toMatch(/Documented findings/);
    expect(system).toMatch(/Cross-article synthesis/);
    expect(system).toMatch(/AI interpretation, not stated by the authors/);
    expect(system).toMatch(/### Supporting evidence/);
    expect(system).toMatch(/### Articles compared/);
    expect(system).toMatch(/Do not claim a consensus/);
    expect(system).toMatch(/never pad a simple answer/);
  });
});

describe("POST /api/corpus-chat conversation context and comparison", () => {
  test("a follow-up that refers back focuses retrieval on the previous answer's articles", async () => {
    await ask("What were the limitations of this study?", [
      { role: "user", content: "Tell me about the mangrove restoration study" },
      { role: "assistant", content: "It found less damage [1].", sources: ["art_1", "art_2"] },
    ]);
    expect(retrievalCalls[0].options.contextArticleIds).toEqual(["art_1", "art_2"]);
    expect(chatCalls[0].user).toContain('RESOLVED REFERENCES: the reader\'s question refers back to [A1] "Coastal Adaptation in Practice"');
  });

  test("“the second study” resolves to the previous answer's second source", async () => {
    await ask("What method did the second study use?", [
      { role: "user", content: "Compare the coastal studies" },
      { role: "assistant", content: "…", sources: ["art_9", "art_1"] },
    ]);
    expect(retrievalCalls[0].options.contextArticleIds).toEqual(["art_1"]);
  });

  test("a new, unrelated question isn't tied to earlier articles", async () => {
    await ask("What have authors found about teacher workload in rural schools across the region?", [
      { role: "user", content: "Tell me about the mangrove restoration study" },
      { role: "assistant", content: "…", sources: ["art_1"] },
    ]);
    expect(retrievalCalls[0].options.contextArticleIds).toEqual([]);
    expect(retrievalQueries[0]).not.toContain("mangrove");
  });

  test("a comparison question retrieves more widely across articles", async () => {
    await ask("Compare the methods used across the studies on coastal adaptation");
    expect(retrievalCalls[0].limit).toBe(14);
    expect(retrievalCalls[0].options.maxFocused).toBe(4);
    expect(chatCalls[0].user).toMatch(/Question type: a comparison or synthesis across articles/);
  });

  test("regenerate answers again from exactly the same evidence", async () => {
    await ask("What did the coastal paper find?", [], { regenerate: true, evidenceIds: ["c1"] });
    expect(evidenceLoads).toEqual([["c1"]]);
    expect(retrievalCalls).toHaveLength(0);
    expect(chatCalls[0].opts.temperature).toBeGreaterThan(0.1);
    expect(chatCalls[0].user).toMatch(/regenerated answer/);
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
    expect(body.journal).toEqual({ name: "Journal of Test Studies", issn: "1234-5678", publisher: "Test Press" });
    expect(body.stats.articles).toBe(1);
    expect(body.prompts.some((p: { category: string }) => p.category === "Synthesize the journal")).toBe(true);
  });
});
