import { describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { OPEN_RESOURCES, isNonCommercial, isPublisherHosted, termsFor } from "@/lib/open-resources";
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

describe("Open Resources catalogue files and rights", () => {
  const pub = (p: string) => join(process.cwd(), "public", p.replace(/^\//, ""));

  test("slugs are unique", () => {
    const slugs = OPEN_RESOURCES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const r of OPEN_RESOURCES) {
    test(`${r.slug}: PDF and cover are in place`, () => {
      expect(existsSync(pub(r.coverPath))).toBe(true);
      if (isPublisherHosted(r)) {
        expect(r.pdfPath).toMatch(/^https:\/\//);
        expect(existsSync(pub(`/open-resources/${r.slug}.pdf`))).toBe(false);
      } else {
        expect(existsSync(pub(r.pdfPath))).toBe(true);
        const mb = statSync(pub(r.pdfPath)).size / 1e6;
        expect(Math.abs(mb - r.fileSizeMb)).toBeLessThan(0.06);
      }
    });
  }

  test("OECD titles link to the OECD's copy and use an identification tile", () => {
    for (const r of OPEN_RESOURCES.filter((x) => x.org === "OECD")) {
      expect(isPublisherHosted(r)).toBe(true);
      expect(r.coverKind).toBe("tile");
    }
  });

  test("UNESCO titles keep the UNESCO terms; others name their own or none", () => {
    for (const r of OPEN_RESOURCES) {
      const t = termsFor(r);
      if (!r.org) expect(t?.label).toContain("UNESCO");
      else expect(t?.label ?? "").not.toContain("UNESCO Open Access Repository");
    }
  });

  test("NonCommercial titles are flagged", () => {
    expect(OPEN_RESOURCES.filter(isNonCommercial).map((r) => r.slug)).toContain("national-skills-strategies-saudi-arabia-2025");
  });
});
