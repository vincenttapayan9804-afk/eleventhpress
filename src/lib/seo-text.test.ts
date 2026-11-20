import { describe, expect, test } from "bun:test";
import { clipText, MAX_DESCRIPTION, MAX_TITLE, searchDescription, searchTitle } from "./seo-text";

describe("search snippet lengths", () => {
  test("keeps the full brand when it fits, then the short one, then none", () => {
    expect(searchTitle("Short headline", ["Eleventh Press International Publishing™", "Eleventh Press"])).toBe(
      "Short headline | Eleventh Press International Publishing™",
    );
    expect(searchTitle("A Plain-Language Guide to Double-Blind Peer Review", ["Eleventh Press International Publishing™", "Eleventh Press"])).toBe(
      "A Plain-Language Guide to Double-Blind Peer Review | Eleventh Press",
    );
    const long = searchTitle("Classroom Learning Environment and Institutional Support as Predictors of Students’ Motivated Strategies", ["Eleventh Press"]);
    expect(long.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(long.endsWith("…")).toBe(true);
  });

  test("collapses stray whitespace", () => {
    expect(searchTitle("EDUCATION  (TLE)       ")).toBe("EDUCATION (TLE)");
  });

  test("descriptions never exceed 160 and cut on a word boundary", () => {
    const d = searchDescription("word ".repeat(80));
    expect(d.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(d).toMatch(/word…$/);
    expect(searchDescription("Already short enough.")).toBe("Already short enough.");
    expect(clipText("abc", 10)).toBe("abc");
  });
});
