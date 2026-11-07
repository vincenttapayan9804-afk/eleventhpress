import { describe, expect, test } from "bun:test";
import { brandCssVars, contrastRatio, extractPalette, normalizeHex, readableOn, BRAND_COLOR_PRESETS } from "./brand-colors";

describe("brand colours", () => {
  test("normalizes hex", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("4b2e83")).toBe("#4b2e83");
    expect(normalizeHex("oklch(0.4 0.1 290)")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });

  test("picks a readable foreground", () => {
    expect(readableOn("#1f3a68")).toBe("#ffffff");
    expect(readableOn("#f3e3b5")).toBe("#16121f");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  test("derives a light + dark palette from hex", () => {
    const css = brandCssVars("#1f3a68", "#dbe6f5");
    expect(css).toContain("--primary:#1f3a68;--primary-foreground:#ffffff;--ring:#1f3a68");
    expect(css).toContain("--royal-600:#1f3a68");
    expect(css).toMatch(/:root:root\{--royal-50:#[0-9a-f]{6}/);
    expect(css).toContain("--accent:#dbe6f5;--accent-foreground:#16121f");
    expect(css).toContain(":root.dark{--royal-50:");
    // a very dark primary is lightened for dark mode
    expect(css.split(":root.dark")[1]).not.toContain("--primary:#1f3a68");
  });

  test("passes legacy CSS colours through to --primary only", () => {
    expect(brandCssVars("oklch(0.38 0.18 295)", null)).toBe(":root:root{--primary:oklch(0.38 0.18 295)}");
    expect(brandCssVars(null, null)).toBe("");
  });

  test("every preset reads well with its button text", () => {
    for (const p of BRAND_COLOR_PRESETS) {
      expect(contrastRatio(p.primary, readableOn(p.primary))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("extracts distinct non-background colours from pixels", () => {
    const px: number[] = [];
    const push = (r: number, g: number, b: number, a = 255, n = 50) => {
      for (let i = 0; i < n; i++) px.push(r, g, b, a);
    };
    push(255, 255, 255, 255, 400); // white background — ignored
    push(0, 0, 0, 0, 400); // transparent — ignored
    push(30, 60, 110, 255, 200); // navy
    push(200, 30, 40, 255, 80); // red
    const colors = extractPalette(px, 4);
    expect(colors.length).toBe(2);
    expect(colors[0]).toBe("#1e3c6e");
  });
});
