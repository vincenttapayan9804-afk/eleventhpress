import { describe, expect, test } from "bun:test";
import { OPEN_RESOURCES } from "@/lib/open-resources";
import { OPEN_RESOURCE_TAKEAWAYS, takeawaysFor, takeawaysPdfPath } from "@/lib/open-resources-takeaways";
import { buildTakeawaysPdf, takeawaysPdfFileName } from "@/lib/open-resource-takeaways-pdf";

describe("Open Resources editorial takeaways", () => {
  test("every title has takeaways, and every takeaway belongs to a title", () => {
    const slugs = new Set(OPEN_RESOURCES.map((r) => r.slug));
    for (const r of OPEN_RESOURCES) expect(takeawaysFor(r.slug)).not.toBeNull();
    for (const slug of Object.keys(OPEN_RESOURCE_TAKEAWAYS)) expect(slugs.has(slug)).toBe(true);
  });

  test("document codes are unique and well formed", () => {
    const codes = Object.values(OPEN_RESOURCE_TAKEAWAYS).map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^EP-OR-\d\d$/);
  });

  test("each set has five takeaways, a perspective and research questions", () => {
    for (const t of Object.values(OPEN_RESOURCE_TAKEAWAYS)) {
      expect(t.takeaways.length).toBe(5);
      for (const k of t.takeaways) {
        expect(k.title.length).toBeGreaterThan(5);
        expect(k.text.length).toBeGreaterThan(40);
      }
      expect(t.whyItMatters.length).toBeGreaterThan(80);
      expect(t.researchQuestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  for (const r of OPEN_RESOURCES) {
    test(`${r.slug} renders a branded PDF`, async () => {
      const tk = takeawaysFor(r.slug)!;
      const buf = await buildTakeawaysPdf(r, tk);
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      const pages = buf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
      expect(pages).toBeGreaterThanOrEqual(2);
      expect(pages).toBeLessThanOrEqual(5);
      expect(takeawaysPdfFileName(r, tk)).toMatch(/^eleventh-press-ep-or-\d\d-takeaways-[a-z0-9-]+\.pdf$/);
      expect(takeawaysPdfPath(r.slug)).toBe(`/resources/open-resources/${r.slug}/takeaways/pdf`);
    });
  }
});
