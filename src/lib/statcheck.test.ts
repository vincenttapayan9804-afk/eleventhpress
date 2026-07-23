/// <reference types="bun-types" />
/**
 * Tests for the statcheck reimplementation (src/lib/statcheck.ts). All
 * expected p-values below were independently verified by calling jstat's
 * real CDFs directly (not hand-derived), matching well-known textbook
 * reference points (e.g. t(28) ≈ 2.048 is the classic critical value for
 * p = .05 two-tailed at df = 28; chi2(1) = 6.63 is the classic p = .01
 * critical value).
 */
import { describe, test, expect } from "bun:test";
import { runStatcheck } from "@/lib/statcheck";

describe("runStatcheck", () => {
  test("returns nothing for plain prose with no reported statistics", () => {
    expect(runStatcheck("This paper discusses microplastic retention in stormwater biofilters.")).toEqual([]);
  });

  test("t-test: consistent report is not flagged", () => {
    const [result] = runStatcheck("Retention differed significantly, t(28) = 2.50, p = .02.");
    expect(result.test).toBe("t");
    expect(result.consistent).toBe(true);
    expect(result.decisionError).toBe(false);
  });

  test("t-test: a wildly wrong reported p is a decision error", () => {
    const [result] = runStatcheck("The groups did not differ, t(30) = 5.00, p = .800.");
    expect(result.consistent).toBe(false);
    expect(result.decisionError).toBe(true);
    expect(result.computedP).toBeLessThan(0.001);
  });

  test("t-test: 'p < .001' for a huge statistic is consistent (both significant)", () => {
    const [result] = runStatcheck("t(30) = 5.00, p < .001");
    expect(result.consistent).toBe(true);
    expect(result.decisionError).toBe(false);
  });

  test("F-test is recognized and recomputed", () => {
    const [result] = runStatcheck("The model was a good fit, F(2, 30) = 4.50, p = .02.");
    expect(result.test).toBe("F");
    expect(result.df1).toBe(2);
    expect(result.df2).toBe(30);
    expect(result.consistent).toBe(true);
  });

  test("correlation r-test is recognized and recomputed", () => {
    const [result] = runStatcheck("Scores were correlated, r(50) = .30, p = .03.");
    expect(result.test).toBe("r");
    expect(result.computedP).toBeCloseTo(0.0307, 3);
    expect(result.consistent).toBe(true);
  });

  test("chi-square test is recognized and recomputed", () => {
    const [result] = runStatcheck("A chi-square test was significant, chi-square(1) = 6.63, p = .01.");
    expect(result.test).toBe("chi2");
    expect(result.consistent).toBe(true);
  });

  test("finds multiple independent reports in the same text", () => {
    const results = runStatcheck("t(28) = 2.50, p = .02. Separately, F(2, 30) = 4.50, p = .02.");
    expect(results.length).toBe(2);
    expect(results.map((r) => r.test)).toEqual(["t", "F"]);
  });
});
