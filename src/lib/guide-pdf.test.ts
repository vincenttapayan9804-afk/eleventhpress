import { describe, expect, test } from "bun:test";
import { GUIDES } from "@/lib/resources-content";
import { getGuideDoc } from "@/lib/resources";
import { buildGuidePdf, guidePdfFileName } from "@/lib/guide-pdf";

describe("guide PDF", () => {
  for (const g of GUIDES) {
    test(`${g.code} renders a multi-page branded PDF`, async () => {
      const guide = getGuideDoc(g.slug)!;
      const buf = await buildGuidePdf(guide);
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      const raw = buf.toString("latin1");
      const pages = raw.match(/\/Type \/Page\b/g)?.length ?? 0;
      expect(pages).toBeGreaterThanOrEqual(4);
      expect(guidePdfFileName(guide)).toMatch(/^eleventh-press-ep-g-\d\d-[a-z0-9-]+-v\d+\.\d+\.pdf$/);
    });
  }
});
