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
type LlmStreamModule = typeof import("@/lib/llm-stream");
type ChunksModule = typeof import("@/lib/chunk-embeddings");
type RateLimitModule = typeof import("@/lib/ratelimit");
type DbModule = typeof import("@/lib/db");
type RlsModule = typeof import("@/lib/db-rls");
// Query-string specifiers bypass any mock another file registered. They are
// held in variables so the type checker doesn't try to resolve them.
const REAL = {
  llmStream: "../../../lib/llm-stream.ts?real=corpus-chat-route-test",
  chunks: "../../../lib/chunk-embeddings.ts?real=corpus-chat-route-test",
  ratelimit: "../../../lib/ratelimit.ts?real=corpus-chat-route-test",
  db: "../../../lib/db.ts?real=corpus-chat-route-test",
  rls: "../../../lib/db-rls.ts?real=corpus-chat-route-test",
};
const realLlmStream = (await import(REAL.llmStream)) as LlmStreamModule;
const realChunks = (await import(REAL.chunks)) as ChunksModule;
const realRateLimit = (await import(REAL.ratelimit)) as RateLimitModule;
const realDb = (await import(REAL.db)) as DbModule;
const realRls = (await import(REAL.rls)) as RlsModule;

let active = false;
let llmConfigured = true;
let chatFailure: Error | null = null;
/** The model never answers: the mock waits until the call is aborted. */
let hang = false;
let retrievalFailure: Error | null = null;
/** Replies handed out by the streamChat mock in order; the last repeats. Each is
 * either an Error or { answer, grounded?, suggestedQuestions? }, written out
 * in the model's text format (answer, then a FOLLOW-UPS: section). */
let chatReplies: unknown[] = [];
let chatCalls: { system: string; user: string; opts: any }[] = [];
let retrievalQueries: string[] = [];
let retrievalCalls: { query: string; limit: unknown; options: any }[] = [];
let evidenceLoads: string[][] = [];
let evidenceWheres: unknown[] = [];
let rateLimitOverride: Record<string, unknown> | null = null;
let rateLimitKeys: string[] = [];
let settingsRow: Record<string, unknown> | null = null;
let platformTenant = true;
/** Paper mode (Ask this paper): the article's status, its passages, on-demand indexing calls. */
let paperStatus = "PUBLISHED";
let paperPassages: unknown[] = [];
let paperRetrievals: { articleId: string; query: string; limit: unknown }[] = [];
let indexCalls: string[] = [];
/** Passages from another article mixed into an evidence reload. */
let evidenceFromOtherArticle = false;
/** Correction notices on the cited articles. */
let corrections: { articleId: string; type: string; title: string; doi: string | null; issuedAt: Date }[] = [];

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

/** A reply object as the model would write it. */
function replyText(reply: any): string {
  const answer = reply.grounded === false ? `The journal's records don't cover this. ${reply.answer}` : String(reply.answer);
  const followUps = Array.isArray(reply.suggestedQuestions) ? reply.suggestedQuestions.filter((q: unknown) => typeof q === "string") : [];
  return followUps.length ? `${answer}\n\nFOLLOW-UPS:\n${followUps.map((q: string) => `- ${q}`).join("\n")}` : answer;
}

mock.module("@/lib/llm-stream", () => ({
  ...realLlmStream,
  anyStreamProvider: () => (active ? llmConfigured : realLlmStream.anyStreamProvider()),
  streamChat: (async (...args: Parameters<LlmStreamModule["streamChat"]>) => {
    if (!active) return realLlmStream.streamChat(...args);
    chatCalls.push({ system: args[0], user: args[1], opts: args[2] });
    if (chatFailure) throw chatFailure;
    if (hang) {
      await new Promise((_, reject) => {
        const signal = args[2].signal;
        if (signal?.aborted) reject(new Error("aborted"));
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
    const reply = chatReplies.length > 1 ? chatReplies.shift() : chatReplies[0];
    if (reply instanceof Error) throw reply;
    if (reply instanceof realLlmStream.StreamInterruptedError) throw reply;
    const text = replyText(reply ?? { answer: "Restoration cut damage by 30%." });
    // Delivered in two pieces, as a stream would be.
    const mid = Math.floor(text.length / 2);
    args[2].onDelta?.(text.slice(0, mid));
    args[2].onDelta?.(text.slice(mid));
    return { text, provider: "oss-free", model: "test-model", firstTokenMs: 5, attempts: 1 };
  }) as LlmStreamModule["streamChat"],
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
    evidenceWheres.push(args[1]);
    const own = [{ ...PASSAGE, focused: undefined }];
    return evidenceFromOtherArticle ? [...own, { ...PASSAGE, chunkId: "other", articleId: "art_2", articleTitle: "Another paper" }] : own;
  }) as unknown as ChunksModule["loadCorpusChunksByIds"],
  retrieveChunks: (async (...args: Parameters<ChunksModule["retrieveChunks"]>) => {
    if (!active) return realChunks.retrieveChunks(...args);
    paperRetrievals.push({ articleId: args[0], query: String(args[1]), limit: args[2] });
    if (retrievalFailure) throw retrievalFailure;
    return paperPassages;
  }) as unknown as ChunksModule["retrieveChunks"],
  indexArticleChunks: (async (...args: Parameters<ChunksModule["indexArticleChunks"]>) => {
    if (!active) return realChunks.indexArticleChunks(...args);
    indexCalls.push(args[0]);
    return { chunkCount: 0 };
  }) as unknown as ChunksModule["indexArticleChunks"],
}));

// Paper mode looks the article up under the tenant's row-level security.
mock.module("@/lib/db-rls", () => ({
  ...realRls,
  withTenantRlsContext: (async (tenantId: string | null, fn: (tx: any) => Promise<unknown>) =>
    active
      ? fn({ article: { findUnique: async ({ where }: any) => (where.id === "art_1" ? { id: "art_1", title: RECORD.title, status: paperStatus } : null) } })
      : realRls.withTenantRlsContext(tenantId, fn as any)) as unknown as RlsModule["withTenantRlsContext"],
}));

// Rate limiting is covered by its own tests; other files mock it in ways
// that would make this route return 429 here.
mock.module("@/lib/ratelimit", () => ({
  ...realRateLimit,
  checkRateLimit: (async (...args: Parameters<RateLimitModule["checkRateLimit"]>) => {
    if (!active) return realRateLimit.checkRateLimit(...args);
    rateLimitKeys.push(String(args[0]));
    return rateLimitOverride ?? { ok: true };
  }) as unknown as RateLimitModule["checkRateLimit"],
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
      // The request resolves to the platform tenant (or none), with optional assistant settings.
      if (active && prop === "tenantDomain") return { findFirst: async () => null };
      if (active && prop === "tenant") {
        return {
          findFirst: async () => (platformTenant ? { id: "plat_1", slug: "eleventhpress", name: "Eleventh Press", status: "ACTIVE", isPlatform: true } : null),
          findUnique: async () => null,
        };
      }
      if (active && prop === "researchAssistantSettings") {
        return { findUnique: async () => settingsRow };
      }
      if (active && prop === "researchQueryLog") return { create: async () => ({}) };
      if (active && prop === "correction") {
        return { findMany: async ({ where }: any) => corrections.filter((c) => where.articleId.in.includes(c.articleId)) };
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { POST, GET } = await import("./route");
const { clearAssistantSettingsCache } = await import("@/lib/research-assistant-settings");

const RAW_ANTHROPIC_401 =
  '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cgkqxuocu1QutkjdeChzJ"}';

let ipCounter = 0;
function ask(
  question = "What have authors found about climate adaptation?",
  history?: { role: string; content: string; sources?: string[] }[],
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
) {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/corpus-chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${ipCounter}`, ...headers },
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
  hang = false;
  retrievalFailure = null;
  chatReplies = [];
  chatCalls = [];
  retrievalQueries = [];
  retrievalCalls = [];
  evidenceLoads = [];
  evidenceWheres = [];
  rateLimitOverride = null;
  rateLimitKeys = [];
  settingsRow = null;
  platformTenant = true;
  corrections = [];
  paperStatus = "PUBLISHED";
  paperPassages = [
    { chunkId: "p1", chunkIndex: 3, score: 1, matchType: "lexical", text: "The study surveyed 412 households in coastal districts." },
    { chunkId: "p2", chunkIndex: 0, score: 0.5, matchType: "vector", text: "Mangrove restoration reduced storm-surge damage by 30%." },
  ];
  paperRetrievals = [];
  indexCalls = [];
  evidenceFromOtherArticle = false;
  clearAssistantSettingsCache();
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

  test("a cited article that has been retracted is called out with the answer", async () => {
    corrections = [{ articleId: "art_1", type: "RETRACTION", title: "Retraction notice", doi: null, issuedAt: new Date("2026-06-01T00:00:00Z") }];
    const body = await (await ask()).json();
    expect(body.mode).toBe("answered");
    expect(body.evidence.status).toBe("review");
    expect(body.evidence.warnings[0]).toMatch(/Source 1 has been retracted/);
  });

  test("a corrigendum alone doesn't add a warning", async () => {
    corrections = [{ articleId: "art_1", type: "CORRIGENDUM", title: "Corrected table", doi: null, issuedAt: new Date("2026-06-01T00:00:00Z") }];
    const body = await (await ask()).json();
    expect(body.evidence.warnings.join(" ")).not.toMatch(/retracted|concern/);
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

  test("a failed first attempt is retried once", async () => {
    chatReplies = [new Error("Every model provider failed: oss-free:test: 502"), { answer: "Second try.", usedPassages: [1], grounded: true }];
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
    expect(chatCalls[0].system).toContain("FOLLOW-UPS:");
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

describe("scope, tenant isolation and continuing an analysis", () => {
  test("retrieval is limited to the institution's own published articles", async () => {
    await ask();
    expect(retrievalCalls[0].options.articleWhere).toEqual({ status: "PUBLISHED", journal: { tenantId: "plat_1" } });
  });

  test("a reader's scope narrows retrieval and is stated in the prompt", async () => {
    const body = await (await ask("What did these studies find?", [], { scope: { disciplines: ["Environmental Science"], yearFrom: 2025, yearTo: 2026 } })).json();
    const where = retrievalCalls[0].options.articleWhere;
    expect(where.discipline).toEqual({ in: ["Environmental Science"] });
    expect(where.publishedAt.gte.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(chatCalls[0].user).toContain("SCOPE: the reader limited the search to Environmental Science; published 2025–2026");
    expect(body.coverage.scope).toBe("Environmental Science; published 2025–2026");
  });

  test("“only this article” focuses retrieval on it", async () => {
    await ask("What were the limitations?", [], { scope: { articleIds: ["art_1"] } });
    expect(retrievalCalls[0].options.contextArticleIds).toEqual(["art_1"]);
    expect(retrievalCalls[0].options.articleWhere.id).toEqual({ in: ["art_1"] });
  });

  test("“Continue analysis” keeps the earlier answer's evidence and asks the model to build on it", async () => {
    const body = await (await ask("Go deeper into the methods", [], { continueOf: { question: "What did the coastal paper find?", evidenceIds: ["c9"] } })).json();
    expect(evidenceLoads).toEqual([["c9"]]);
    expect(retrievalQueries[0]).toContain("What did the coastal paper find?");
    expect(chatCalls[0].user).toContain('CONTINUING AN ANALYSIS: the reader is continuing the analysis of their earlier question "What did the coastal paper find?"');
    expect(body.mode).toBe("answered");
  });

  test("regenerating only reuses evidence from the institution's own articles", async () => {
    await ask("What did the coastal paper find?", [], { regenerate: true, evidenceIds: ["c1"] });
    expect(evidenceWheres[0]).toEqual({ status: "PUBLISHED", journal: { tenantId: "plat_1" } });
  });

  test("an answer reports how much of the journal it stands on", async () => {
    const body = await (await ask()).json();
    expect(body.coverage).toEqual({ level: "limited", citedArticles: 1, articlesReviewed: 1, corpusArticles: 1, scope: null });
  });
});

describe("quotas and the institution's switch", () => {
  test("a signed-out reader's quota is per network address on this institution's site", async () => {
    await ask();
    expect(rateLimitKeys[0]).toMatch(/^corpus-chat:ip:plat_1:203\.0\.113\.\d+$/);
  });

  test("over the limit: 429 with when it resets and a hint to sign in", async () => {
    rateLimitOverride = { ok: false, mode: "live", message: "", limit: 40, remaining: 0, reset: Date.parse("2026-11-15T10:00:00Z") };
    const res = await ask();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/limit of 40 questions an hour\. Sign in/);
    expect(body.quota).toEqual({ limit: 40, remaining: 0, resetAt: "2026-11-15T10:00:00.000Z", basis: "network" });
  });

  test("questions left are returned with an answer when limits are enforced", async () => {
    rateLimitOverride = { ok: true, mode: "live", message: "", limit: 40, remaining: 39, reset: Date.parse("2026-11-15T10:00:00Z") };
    const body = await (await ask()).json();
    expect(body.quota.remaining).toBe(39);
  });

  test("the institution's own limit applies", async () => {
    settingsRow = { enabled: true, anonymousHourlyLimit: 500, signedInHourlyLimit: null, logQuestions: true, updatedAt: new Date(), starterQuestions: null };
    rateLimitOverride = { ok: false, mode: "live", message: "", limit: 500, remaining: 0, reset: Date.now() + 1000 };
    const body = await (await ask()).json();
    expect(body.error).toMatch(/limit of 500 questions/);
  });

  test("switched off by the institution: no answer, no model call", async () => {
    settingsRow = { enabled: false, logQuestions: true, updatedAt: new Date(), starterQuestions: null };
    const body = await (await ask()).json();
    expect(body.mode).toBe("disabled");
    expect(chatCalls).toHaveLength(0);
  });

  test("the editors' starter questions come first", async () => {
    settingsRow = { enabled: true, logQuestions: true, updatedAt: new Date(), starterQuestions: JSON.stringify(["What is new this year?"]) };
    const body = await (await GET(new NextRequest("http://localhost/api/corpus-chat"))).json();
    expect(body.prompts[0]).toEqual({ category: "Suggested by the editors", question: "What is new this year?" });
    expect(body.assistant).toEqual({ enabled: true, disclaimer: null });
  });
});

describe("streamed answers", () => {
  test("each step is sent as it starts, then the answer", async () => {
    const res = await ask(undefined, undefined, {}, { accept: "application/x-ndjson" });
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === "stage").map((l) => l.stage)).toEqual(["understanding", "searching", "reading", "writing", "checking"]);
    expect(lines.find((l) => l.stage === "reading")).toMatchObject({ passages: 1, articles: 1 });
    const result = lines.at(-1);
    expect(result.type).toBe("result");
    expect(result.mode).toBe("answered");
    expect(result.citations).toHaveLength(1);
  });

  test("a failure is still a friendly result line", async () => {
    chatFailure = new Error(RAW_ANTHROPIC_401);
    const res = await ask(undefined, undefined, {}, { accept: "application/x-ndjson" });
    const text = await res.text();
    expect(text).not.toContain("x-api-key");
    expect(JSON.parse(text.trim().split("\n").at(-1)!).mode).toBe("unavailable");
  });
});

describe("POST /api/corpus-chat streamed answers and the time budget", () => {
  test("the answer is streamed as it is written, without the follow-ups section", async () => {
    chatReplies = [{ answer: "Damage fell by 30% [P1].", suggestedQuestions: ["How was damage measured in Coastal Adaptation in Practice?"] }];
    const res = await ask(undefined, undefined, {}, { accept: "application/x-ndjson" });
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    const streamed = lines.filter((l) => l.type === "delta").map((l) => l.text).join("");
    expect(streamed).toContain("Damage fell by 30% [P1].");
    expect(streamed).not.toContain("FOLLOW-UPS");
    expect(streamed).not.toContain("How was damage measured");
    const result = lines.at(-1);
    expect(result.answer).toBe("Damage fell by 30% [1].");
    expect(result.suggestedQuestions).toEqual(["How was damage measured in Coastal Adaptation in Practice?"]);
    expect(result.incomplete).toBe(false);
  });

  test("a provider that stops part-way keeps the text written so far, marked incomplete", async () => {
    const { StreamInterruptedError } = realLlmStream;
    chatReplies = [
      new StreamInterruptedError("stalled", { text: "Restoration reduced damage by 30% [P1]. The authors also", provider: "oss-free", model: "m", firstTokenMs: 10, attempts: 1 }),
    ];
    const body = await (await ask()).json();
    expect(body.mode).toBe("answered");
    expect(body.incomplete).toBe(true);
    expect(body.answer).toContain("Restoration reduced damage by 30% [1].");
    expect(body.evidence.status).toBe("review");
    expect(body.evidence.warnings[0]).toMatch(/cut short to stay within the time limit/);
  });

  test("no text before the time budget runs out: a clear time-limit message, not a cut-off request", async () => {
    process.env.CORPUS_CHAT_DEADLINE_MS = "60";
    hang = true;
    try {
      const res = await ask(undefined, undefined, {}, { accept: "application/x-ndjson" });
      const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
      const result = lines.at(-1);
      expect(result.type).toBe("result");
      expect(result.mode).toBe("unavailable");
      expect(result.message).toMatch(/time limit/);
    } finally {
      delete process.env.CORPUS_CHAT_DEADLINE_MS;
    }
  });

  test("“The journal's records don't cover this.” marks the answer as not grounded", async () => {
    chatReplies = [{ answer: "The closest articles are about coastal adaptation.", grounded: false }];
    const body = await (await ask("What does the journal say about quantum gravity?")).json();
    expect(body.mode).toBe("answered");
    expect(body.grounded).toBe(false);
    expect(body.evidence.status).toBe("unsupported");
  });
});


/** Ask this paper: the article page's chat is Ask the Corpus in paper mode. */
function askPaper(question = "What method did the authors use, and what was the main finding?", extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return ask(question, undefined, { articleId: "art_1", ...extra }, headers);
}

describe("POST /api/corpus-chat paper mode (Ask this paper)", () => {
  test("answers from that article only, with numbered citations, an APA source and follow-ups", async () => {
    chatReplies = [
      {
        answer: "The authors surveyed 412 households [P1]. Restoration reduced damage by 30% [P2].\n\n### References\nRivera (2026).",
        suggestedQuestions: ["How were the 412 households sampled?"],
      },
    ];
    const body = await (await askPaper()).json();
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
    expect(body.evidenceIds).toEqual(["p1", "p2"]);
    expect(body.suggestedQuestions).toEqual(["How were the 412 households sampled?"]);
    expect(body.sectionArticleId).toBe("art_1");
    expect(body.quota).toBeUndefined();
    expect(paperRetrievals).toHaveLength(1);
    expect(paperRetrievals[0].articleId).toBe("art_1");
    // The journal-wide search is not used.
    expect(retrievalCalls).toHaveLength(0);
  });

  test("the prompt is written for this one article", async () => {
    await askPaper();
    const { system, user } = chatCalls[0];
    expect(system).toContain("Journal of Test Studies");
    expect(system).toContain(RECORD.title);
    expect(system).toContain("This article doesn't cover this.");
    expect(system).not.toContain("Articles compared");
    expect(user).toContain("[A1]");
    expect(user).toContain("[P1 |");
    expect(user).not.toContain("SCOPE:");
  });

  test("streams the answer as it is written, then the verified result", async () => {
    const res = await askPaper(undefined, {}, { accept: "application/x-ndjson" });
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.some((l) => l.type === "delta")).toBe(true);
    expect(lines.find((l) => l.type === "stage" && l.stage === "searching")?.scope).toBe("this article's full text");
    expect(lines.at(-1).type).toBe("result");
    expect(lines.at(-1).mode).toBe("answered");
  });

  test("keeps its own per-network limit instead of the institution's hourly quota", async () => {
    await askPaper();
    expect(rateLimitKeys).toHaveLength(1);
    expect(rateLimitKeys[0]).toMatch(/^article-chat:/);
    rateLimitOverride = { ok: false, message: "Too many questions. Please wait a few minutes." };
    const res = await askPaper();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("Too many questions. Please wait a few minutes.");
  });

  test("still works when the journal-wide assistant is switched off", async () => {
    settingsRow = { enabled: false, logQuestions: true, updatedAt: new Date(), starterQuestions: null };
    const body = await (await askPaper()).json();
    expect(body.mode).toBe("answered");
    const corpus = await (await ask()).json();
    expect(corpus.mode).toBe("disabled");
  });

  test("“This article doesn't cover this.” marks the answer as not grounded", async () => {
    chatReplies = [{ answer: "This article doesn't cover this. It is about mangroves." }];
    const body = await (await askPaper("What does it say about quantum gravity?")).json();
    expect(body.mode).toBe("answered");
    expect(body.grounded).toBe(false);
  });

  test("regenerate reuses this article's evidence only", async () => {
    evidenceFromOtherArticle = true;
    const body = await (await askPaper("What did they find?", { regenerate: true, evidenceIds: ["c1", "other"] })).json();
    expect(evidenceLoads).toEqual([["c1", "other"]]);
    expect(paperRetrievals).toHaveLength(0);
    expect(body.evidenceIds).toEqual(["c1"]);
    expect(chatCalls[0].opts.temperature).toBe(0.5);
    expect(chatCalls[0].user).toContain("regenerated answer");
  });

  test("a follow-up is retrieved together with the previous question", async () => {
    await ask("What were its limitations?", [
      { role: "user", content: "What instrument measured damage?" },
      { role: "assistant", content: "A household survey [1]." },
    ], { articleId: "art_1" });
    expect(paperRetrievals[0].query).toContain("What were its limitations?");
    expect(paperRetrievals[0].query).toContain("What instrument measured damage?");
  });

  test("continue analysis keeps the earlier answer's evidence from this article", async () => {
    evidenceFromOtherArticle = true;
    const body = await (await askPaper("Go deeper on the method", { continueOf: { question: "What method?", evidenceIds: ["c1", "other"] } })).json();
    expect(paperRetrievals[0].query).toContain("What method?");
    expect(body.evidenceIds).toEqual(["p1", "p2", "c1"]);
    expect(chatCalls[0].user).toContain("CONTINUING AN ANALYSIS");
  });

  test("an article with no indexed passages is indexed on demand, then says so if it has no text", async () => {
    paperPassages = [];
    const body = await (await askPaper()).json();
    expect(indexCalls).toEqual(["art_1"]);
    expect(body.mode).toBe("not-indexed");
    expect(body.message).toMatch(/couldn't be indexed for chat/);
  });

  test("an unpublished or unknown article is not found", async () => {
    paperStatus = "UNDER_REVIEW";
    expect((await askPaper()).status).toBe(404);
    paperStatus = "PUBLISHED";
    expect((await ask("Hi?", undefined, { articleId: "art_9" })).status).toBe(404);
    expect((await ask("Hi?", undefined, { articleId: "../x" })).status).toBe(404);
    expect(chatCalls).toHaveLength(0);
  });

  test("a provider failure returns this article's friendly banner, never the raw error", async () => {
    chatFailure = new Error(RAW_ANTHROPIC_401);
    const body = await (await askPaper()).json();
    expect(body.mode).toBe("unavailable");
    expect(body.message).toMatch(/unavailable for this article/);
    expect(JSON.stringify(body)).not.toContain("x-api-key");
  });

  test("no configured provider returns the friendly banner", async () => {
    llmConfigured = false;
    const body = await (await askPaper()).json();
    expect(body.mode).toBe("unavailable");
    expect(chatCalls).toHaveLength(0);
  });
});
