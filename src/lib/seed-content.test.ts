import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEED_ARTICLE_TITLES, isSeedArticleTitle } from "./seed-content";

describe("seed article titles", () => {
  test("match the articles scripts/seed.ts creates", () => {
    const seed = readFileSync(join(import.meta.dir, "../../scripts/seed.ts"), "utf8");
    // Only the ARTICLES array: seed.ts has other `title:` fields (a journal, a notification).
    const start = seed.indexOf("const ARTICLES");
    const articles = seed.slice(start, seed.indexOf("\n];", start));
    const titles = [...articles.matchAll(/^ {4}title:\s*"([^"]+)",?$/gm)].map((m) => m[1]);
    expect(titles.length).toBe(10);
    expect([...SEED_ARTICLE_TITLES].sort()).toEqual(titles.sort());
  });

  test("recognises a seed title, ignoring surrounding whitespace, and nothing else", () => {
    expect(isSeedArticleTitle(` ${SEED_ARTICLE_TITLES[0]} `)).toBe(true);
    expect(isSeedArticleTitle("A real article about something else")).toBe(false);
  });
});
