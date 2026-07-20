/// <reference types="bun-types" />
/**
 * generateGlossary() (src/lib/glossary.ts) — the honesty guarantee matters
 * most here: unlike every other AI feature in this codebase, there is no
 * heuristic fallback at all. On any failure (no LLM configured, or the
 * call throwing) this must return an EMPTY terms list tagged
 * mode: "unavailable" — never a fabricated or guessed definition.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let llmAvailable = true;
let chatJSONShouldFail = false;
let chatJSONResult: { terms: { term: string; definition: string }[] } = {
  terms: [{ term: "Topological insulator", definition: "A material that conducts on its surface but not through its interior." }],
};

mock.module("@/lib/llm", () => ({
  isLLMAvailable: () => llmAvailable,
  anyLLMAvailable: () => llmAvailable,
  chatJSON: mock(async () => {
    if (chatJSONShouldFail) throw new Error("mock LLM failure");
    return { data: chatJSONResult, rawResponse: "", model: "claude-sonnet-5" };
  }),
}));

const { generateGlossary } = await import("@/lib/glossary");

const ARTICLE = {
  title: "Topological Signatures in Strain-Engineered Transition Metal Dichalcogenides",
  abstract: "We report on topological insulator behavior under mechanical strain.",
  keywords: "topology, condensed matter",
  discipline: "Physics",
};

function reset() {
  llmAvailable = true;
  chatJSONShouldFail = false;
  chatJSONResult = {
    terms: [{ term: "Topological insulator", definition: "A material that conducts on its surface but not through its interior." }],
  };
}

beforeEach(reset);

describe("generateGlossary — happy path", () => {
  test("returns the LLM-generated terms with mode 'llm'", async () => {
    const result = await generateGlossary(ARTICLE);
    expect(result.mode).toBe("llm");
    expect(result.terms).toEqual([
      { term: "Topological insulator", definition: "A material that conducts on its surface but not through its interior." },
    ]);
    expect(result.model).toBe("claude-sonnet-5");
    expect(typeof result.generatedAt).toBe("string");
  });

  test("filters out any term/definition pair missing either field", async () => {
    chatJSONResult = {
      terms: [
        { term: "Valid term", definition: "A real definition." },
        { term: "", definition: "Orphaned definition with no term." },
        { term: "Orphaned term", definition: "" },
      ],
    };
    const result = await generateGlossary(ARTICLE);
    expect(result.terms).toEqual([{ term: "Valid term", definition: "A real definition." }]);
  });
});

describe("generateGlossary — honest unavailable state, never a fabricated definition", () => {
  test("returns an empty list tagged 'unavailable' when no LLM is configured", async () => {
    llmAvailable = false;
    const result = await generateGlossary(ARTICLE);
    expect(result.mode).toBe("unavailable");
    expect(result.terms).toEqual([]);
    expect(result.model).toBe("unavailable");
  });

  test("returns an empty list tagged 'unavailable' when the LLM call throws", async () => {
    chatJSONShouldFail = true;
    const result = await generateGlossary(ARTICLE);
    expect(result.mode).toBe("unavailable");
    expect(result.terms).toEqual([]);
  });
});
