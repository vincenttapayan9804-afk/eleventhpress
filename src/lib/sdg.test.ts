import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DISCIPLINES } from "@/lib/article";
import { SDG_GOALS, SDG_POSTER, sdgGoal, sdgLabel, suggestSdgs } from "./sdg";

describe("SDG_GOALS", () => {
  test("has the 17 goals in order, each with an official icon on disk", () => {
    expect(SDG_GOALS.map((g) => g.number)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    for (const g of SDG_GOALS) {
      expect(g.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(existsSync(join(process.cwd(), "public", g.icon))).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "public", SDG_POSTER))).toBe(true);
  });

  test("maps only to the platform's real disciplines, and every discipline is covered", () => {
    const covered = new Set<string>();
    for (const g of SDG_GOALS) {
      for (const d of g.primary) {
        expect(DISCIPLINES as readonly string[]).toContain(d);
        covered.add(d);
      }
      if (g.secondary !== "ALL") for (const d of g.secondary) expect(DISCIPLINES as readonly string[]).toContain(d);
    }
    for (const d of DISCIPLINES) expect(covered.has(d) || d === "Mathematics").toBe(true);
  });

  test("labels use the standard metadata form", () => {
    expect(sdgLabel(13)).toBe("UN SDG 13: Climate Action");
    expect(sdgGoal(18)).toBeUndefined();
    expect(sdgLabel(0)).toBe("");
  });
});

describe("suggestSdgs", () => {
  test("suggests Climate Action for a climate paper, best first", () => {
    const s = suggestSdgs({
      title: "Regional climate modeling of extreme weather in Southeast Asia",
      keywords: "climate change, carbon pricing, emissions",
      abstract: "We assess mitigation policy options.",
      discipline: "Environmental Science",
    });
    expect(s[0].number).toBe(13);
    expect(s[0].matched).toContain("carbon pricing");
  });

  test("a discipline alone never produces a suggestion", () => {
    expect(suggestSdgs({ discipline: "Physics", title: "On the spectrum of a bounded operator" })).toEqual([]);
    expect(suggestSdgs({})).toEqual([]);
  });

  test("matches whole words and simple plurals only", () => {
    // "esg" must not match inside "message"; "batteries" is not "battery" + s, but "smart grids" is.
    expect(suggestSdgs({ keywords: "message passing" }).map((s) => s.number)).not.toContain(12);
    expect(suggestSdgs({ keywords: "smart grids, photovoltaics" })[0].number).toBe(7);
  });

  test("returns at most the limit, and weights keywords over the abstract", () => {
    const text = {
      keywords: "poverty, food security, mental health, literacy, gender",
      abstract: "climate",
    };
    expect(suggestSdgs(text)).toHaveLength(3);
    expect(suggestSdgs(text, 5).map((s) => s.number)).not.toContain(13);
  });

  test("uses the discipline to break ties", () => {
    const s = suggestSdgs({ keywords: "migration, labor market", discipline: "Business" });
    expect(s[0].number).toBe(8);
  });
});
