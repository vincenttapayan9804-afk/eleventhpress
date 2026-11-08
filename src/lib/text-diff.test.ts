import { describe, expect, test } from "bun:test";
import { wordDiff } from "./text-diff";

describe("wordDiff", () => {
  test("marks added and removed words", () => {
    const d = wordDiff("the quick brown fox", "the slow brown fox jumps");
    expect(d.filter((p) => p.type === "removed").map((p) => p.text.trim())).toEqual(["quick"]);
    expect(d.filter((p) => p.type === "added").map((p) => p.text.trim()).join(" ")).toContain("slow");
    expect(d.filter((p) => p.type !== "removed").map((p) => p.text).join("")).toBe("the slow brown fox jumps");
    expect(d.filter((p) => p.type !== "added").map((p) => p.text).join("")).toBe("the quick brown fox");
  });
  test("identical text is one unchanged part", () => {
    expect(wordDiff("same text", "same text")).toEqual([{ type: "same", text: "same text" }]);
  });
});
