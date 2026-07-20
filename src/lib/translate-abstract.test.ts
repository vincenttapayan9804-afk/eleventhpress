/// <reference types="bun-types" />
/**
 * translateAbstract() (src/lib/manuscript-checks.ts) — mode-discriminator
 * and, most importantly, the honesty guarantee: on any failure (no LLM
 * configured, or the call throwing) it must return the original English
 * text tagged mode: "heuristic", never a fabricated or partial
 * translation presented as real.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let llmAvailable = true;
let chatJSONShouldFail = false;
let chatJSONResult = { translatedAbstract: "Resumen traducido de prueba." };

mock.module("@/lib/llm", () => ({
  isLLMAvailable: () => llmAvailable,
  anyLLMAvailable: () => llmAvailable,
  chatJSON: mock(async () => {
    if (chatJSONShouldFail) throw new Error("mock LLM failure");
    return { data: chatJSONResult, rawResponse: "", model: "claude-sonnet-5" };
  }),
}));
// manuscript-checks.ts also imports these — real, pure, no DB/network.
mock.module("@/lib/embeddings", () => ({ generateEmbedding: mock(async () => []) }));
mock.module("@/lib/vector-math", () => ({ cosineSimilarity: () => 0 }));
mock.module("@/lib/db", () => ({ db: {} }));

const { translateAbstract, TRANSLATABLE_LOCALES } = await import("@/lib/manuscript-checks");

const ARTICLE = { title: "A Study of Prime Gaps", abstract: "We study the distribution of gaps between consecutive primes." };

function reset() {
  llmAvailable = true;
  chatJSONShouldFail = false;
  chatJSONResult = { translatedAbstract: "Resumen traducido de prueba." };
}

beforeEach(reset);

describe("translateAbstract — happy path", () => {
  test("returns the translated text with mode 'llm'", async () => {
    const result = await translateAbstract(ARTICLE, "es");
    expect(result.mode).toBe("llm");
    expect(result.translatedAbstract).toBe("Resumen traducido de prueba.");
    expect(result.model).toBe("claude-sonnet-5");
  });

  test("TRANSLATABLE_LOCALES covers all 4 non-English site locales", () => {
    const actual: string[] = [...TRANSLATABLE_LOCALES].sort();
    expect(actual).toEqual(["es", "fil", "fr", "zh-Hans"].sort());
  });
});

describe("translateAbstract — honest fallback, never a fabricated/partial translation", () => {
  test("returns the original English text unchanged, tagged heuristic, when no LLM is configured", async () => {
    llmAvailable = false;
    const result = await translateAbstract(ARTICLE, "fr");
    expect(result.mode).toBe("heuristic");
    expect(result.translatedAbstract).toBe(ARTICLE.abstract);
    expect(result.model).toBe("heuristic-fallback");
  });

  test("returns the original English text unchanged, tagged heuristic, when the LLM call throws", async () => {
    chatJSONShouldFail = true;
    const result = await translateAbstract(ARTICLE, "zh-Hans");
    expect(result.mode).toBe("heuristic");
    expect(result.translatedAbstract).toBe(ARTICLE.abstract);
  });

  test("treats an empty translatedAbstract response as a failure, not a valid (blank) translation", async () => {
    chatJSONResult = { translatedAbstract: "" };
    const result = await translateAbstract(ARTICLE, "fil");
    expect(result.mode).toBe("heuristic");
    expect(result.translatedAbstract).toBe(ARTICLE.abstract);
  });
});
