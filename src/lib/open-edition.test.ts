import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OPEN_EDITION_ISSUES, getOpenEditionIssue, openEditionCopyright, readingMinutes } from "./open-edition";
import { pathForState, stateForPath } from "./spa-routes";

const PUBLIC = join(import.meta.dir, "..", "..", "public");

describe("Open Edition issues", () => {
  test("originals are all rights reserved, not Creative Commons", () => {
    expect(openEditionCopyright(2026)).toBe("© 2026 Eleventh Press International Publishing™. All rights reserved.");
  });

  test("issue ids are unique and route to /magazines/<id>", () => {
    const ids = OPEN_EDITION_ISSUES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const state = stateForPath(`/magazines/${id}`);
      expect(state).toEqual({ view: "magazineIssue", magazineIssueId: id });
      expect(pathForState(state!)).toBe(`/magazines/${id}`);
      expect(getOpenEditionIssue(id)?.id).toBe(id);
    }
    expect(getOpenEditionIssue("not-an-issue")).toBeUndefined();
    expect(getOpenEditionIssue(null)).toBeUndefined();
  });

  for (const issue of OPEN_EDITION_ISSUES) {
    describe(issue.id, () => {
      test("cover and every article image exist in /public", () => {
        expect(existsSync(join(PUBLIC, issue.cover))).toBe(true);
        for (const p of issue.pieces) expect(existsSync(join(PUBLIC, p.image))).toBe(true);
      });

      test("print edition PDF exists (run scripts/build-open-edition-pdf.ts)", () => {
        expect(issue.pdf).toMatch(/^\/magazines\/open-edition\/.+\.pdf$/);
        const pdf = join(PUBLIC, issue.pdf);
        expect(existsSync(pdf)).toBe(true);
        expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-");
      });

      test("piece slugs are unique", () => {
        const slugs = issue.pieces.map((p) => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
      });

      test("has at least five original features", () => {
        expect(issue.pieces.filter((p) => p.kind === "original").length).toBeGreaterThanOrEqual(5);
      });

      if (issue.issueNumber >= 2) {
        test("from No. 2: 6 to 8 originals and more than 3 licensed reprints", () => {
          const originals = issue.pieces.filter((p) => p.kind === "original").length;
          expect(originals).toBeGreaterThanOrEqual(6);
          expect(originals).toBeLessThanOrEqual(8);
          expect(issue.pieces.filter((p) => p.kind === "reprint").length).toBeGreaterThan(3);
        });
      }

      test("cover settings are complete", () => {
        expect(issue.coverLine.length).toBeGreaterThan(10);
        if (issue.coverStyle === "frame") expect(issue.coverKicker?.length).toBeGreaterThan(3);
      });

      for (const p of issue.pieces) {
        test(`${p.slug}: markup is safe and alt text present`, () => {
          expect(p.bodyHtml).not.toMatch(/<script|<iframe|\son\w+=|javascript:/i);
          expect(p.imageAlt.length).toBeGreaterThan(5);
          expect(readingMinutes(p.bodyHtml)).toBeGreaterThan(0);
        });

        if (p.kind === "original") {
          test(`${p.slug}: every citation points at a listed source`, () => {
            expect(p.sources?.length).toBeGreaterThan(0);
            expect(p.refPrefix).toBeTruthy();
            const cited = [...p.bodyHtml.matchAll(new RegExp(`#${p.refPrefix}-s(\\d+)`, "g"))].map((m) => Number(m[1]));
            expect(cited.length).toBeGreaterThan(0);
            for (const n of cited) expect(n).toBeLessThanOrEqual(p.sources!.length);
            // Every listed source is cited at least once.
            for (let n = 1; n <= p.sources!.length; n++) expect(cited).toContain(n);
          });

          test(`${p.slug}: has a verification log`, () => {
            expect(p.verification?.length).toBeGreaterThan(0);
          });
        } else {
          test(`${p.slug}: reprint carries its licence and source`, () => {
            const licence = p.reprint!.licence;
            if (/^public domain/i.test(licence.label)) {
              // Public-domain works (e.g. NASA) link to the publisher's usage terms.
              expect(licence.url).toMatch(/^https:\/\//);
            } else {
              expect(licence.url).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
              // Non-commercial licences are not usable on a site that sells books.
              expect(licence.label).not.toMatch(/NC/);
            }
            if (p.reprint!.counterPixel) expect(p.reprint!.counterPixel).toMatch(/^https:\/\//);
            expect(p.reprint?.sourceUrl).toMatch(/^https:\/\//);
            expect(p.verification).toBeUndefined();
          });
        }
      }
    });
  }
});
