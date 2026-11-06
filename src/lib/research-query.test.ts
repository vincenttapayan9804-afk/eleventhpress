import { describe, test, expect } from "bun:test";
import { analyzeQuestion, cleanSourceIds, resolveContextArticles, retrievalPlan } from "./research-query";

describe("analyzeQuestion", () => {
  test("recognises comparison, bibliographic, section and overview questions", () => {
    expect(analyzeQuestion("Compare the methods of the two counseling studies").intent).toBe("comparison");
    expect(analyzeQuestion("How do the findings differ between the studies?").intent).toBe("comparison");
    expect(analyzeQuestion("Who wrote the mangrove paper?").intent).toBe("bibliographic");
    expect(analyzeQuestion("What instruments were used to collect data?").intent).toBe("section");
    expect(analyzeQuestion("What topics does this journal cover?").intent).toBe("overview");
    expect(analyzeQuestion("Tell me about mangroves").intent).toBe("general");
  });

  test("resolves references to earlier articles", () => {
    expect(analyzeQuestion("What were the limitations of this article?").refersToContext).toBe(true);
    expect(analyzeQuestion("What were its limitations?").refersToContext).toBe(true);
    expect(analyzeQuestion("How do those findings compare with other studies?").refersToContext).toBe(true);
    expect(analyzeQuestion("What did the second study find?").ordinal).toBe(2);
    expect(analyzeQuestion("Explain the second methodology").ordinal).toBe(2);
    expect(analyzeQuestion("And the latter?").ordinal).toBe(-1);
    expect(analyzeQuestion("What else did the same author publish?").sameAuthor).toBe(true);
  });

  test("a pronoun inside a longer, self-contained question isn't a back-reference", () => {
    expect(analyzeQuestion("How do teachers in rural public schools describe their workload and what support do they receive?").refersToContext).toBe(false);
    expect(analyzeQuestion("What have authors found about climate adaptation?").refersToContext).toBe(false);
  });
});

describe("resolveContextArticles", () => {
  const history = [
    { role: "user" as const, content: "Compare the studies" },
    { role: "assistant" as const, content: "…", sources: ["a1", "a2", "a3"] },
  ];

  test("uses the previous answer's sources, or the one an ordinal picks out", () => {
    expect(resolveContextArticles(analyzeQuestion("What were its limitations?"), history)).toEqual(["a1", "a2", "a3"]);
    expect(resolveContextArticles(analyzeQuestion("What sample did the second study use?"), history)).toEqual(["a2"]);
    expect(resolveContextArticles(analyzeQuestion("And the latter?"), history)).toEqual(["a3"]);
  });

  test("nothing when the question doesn't refer back or there's no earlier answer", () => {
    expect(resolveContextArticles(analyzeQuestion("What is known about mangroves?"), history)).toEqual([]);
    expect(resolveContextArticles(analyzeQuestion("What were its limitations?"), [])).toEqual([]);
  });

  test("ignores malformed source ids from the client", () => {
    expect(cleanSourceIds(["ok_1", "ok_1", "bad id", 7, "x".repeat(80)])).toEqual(["ok_1"]);
    expect(cleanSourceIds("nope")).toEqual([]);
  });
});

test("comparisons retrieve more widely than lookups", () => {
  expect(retrievalPlan(analyzeQuestion("Compare the two studies")).limit).toBeGreaterThan(retrievalPlan(analyzeQuestion("Who wrote it?")).limit);
});
