/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { buildMagazinePackage, getMagazinePlatform, MAGAZINE_PLATFORMS } from "@/lib/magazine-distribution";

const ISSUE = {
  id: "issue-1",
  title: "The Autumn Number",
  volume: 4,
  issueNumber: 2,
  year: 2026,
  theme: "Fieldwork",
  magazineName: "Eleventh Press Review",
  magazineDescription: "A quarterly magazine of research culture and public scholarship.",
};

describe("MAGAZINE_PLATFORMS / getMagazinePlatform", () => {
  test("Tier C platforms (Flipboard, Apple News) have no consent requirement or submit URL", () => {
    for (const p of MAGAZINE_PLATFORMS.filter((p) => p.tier === "C")) {
      expect(p.consentText).toBeUndefined();
      expect(p.submitUrl).toBeUndefined();
    }
  });

  test("Tier B platforms (Issuu, PressReader) require consent and have a submit URL", () => {
    const tierB = MAGAZINE_PLATFORMS.filter((p) => p.tier === "B");
    expect(tierB.map((p) => p.id).sort()).toEqual(["ISSUU", "PRESSREADER"]);
    for (const p of tierB) {
      expect(p.consentText).toBeTruthy();
      expect(p.submitUrl).toBeTruthy();
    }
  });

  test("getMagazinePlatform resolves a known id and returns undefined for an unknown one", () => {
    expect(getMagazinePlatform("ISSUU")?.label).toBe("Issuu");
    expect(getMagazinePlatform("NOT_A_PLATFORM")).toBeUndefined();
  });
});

describe("buildMagazinePackage", () => {
  test("uses the issue's own title when present", () => {
    const pkg = buildMagazinePackage(ISSUE);
    expect(pkg.issueTitle).toBe("The Autumn Number");
    expect(pkg.magazineName).toBe("Eleventh Press Review");
    expect(pkg.theme).toBe("Fieldwork");
    expect(pkg.description).toBe(ISSUE.magazineDescription);
  });

  test("falls back to a Vol./No./year label when the issue has no title", () => {
    const pkg = buildMagazinePackage({ ...ISSUE, title: null });
    expect(pkg.issueTitle).toBe("Vol. 4, No. 2 (2026)");
  });

  test("falls back to null theme when absent", () => {
    const pkg = buildMagazinePackage({ ...ISSUE, theme: null });
    expect(pkg.theme).toBeNull();
  });

  test("derives a canonical URL from the issue id", () => {
    const pkg = buildMagazinePackage(ISSUE);
    expect(pkg.canonicalUrl.endsWith(`/magazine/${ISSUE.id}`)).toBe(true);
  });
});
