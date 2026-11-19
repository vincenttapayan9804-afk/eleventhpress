import { describe, expect, test } from "bun:test";
import { GUIDES } from "@/lib/resources-content";
import { getGuideDoc, guideCitation } from "@/lib/resources";
import { PLATFORM_RESOURCE_BRAND, brandCode, brandContactLine, brandText, type ResourceBrand } from "./tenant-brand";

const RON: ResourceBrand = {
  whitelabel: true,
  publisher: "Ron International Publishing",
  shortName: "Ron International Publishing",
  journalName: "Ron Journal of Research",
  email: "editor@ron.example.org",
  issn: null,
  location: "Cebu, Philippines",
  baseUrl: "https://ron-international-publishing.eleventhpress.com",
  logoUrl: "https://ron-international-publishing.eleventhpress.com/pwa-icon/512",
  primaryHex: "#0b4f6c",
  accentHex: "#d4a017",
};

describe("tenant-branded guides", () => {
  test("the platform keeps its own text", () => {
    expect(brandText("Eleventh Press issues four kinds of notice", PLATFORM_RESOURCE_BRAND)).toBe("Eleventh Press issues four kinds of notice");
    expect(brandCode("EP-G-01", PLATFORM_RESOURCE_BRAND)).toBe("EP-G-01");
  });

  test("a tenant's name, email, site and codes replace Eleventh Press's", () => {
    expect(brandText("Eleventh Press International Publishing™ follows COPE", RON)).toBe("Ron International Publishing follows COPE");
    expect(brandText("Write to editorial@eleventhpress.com", RON)).toBe("Write to editor@ron.example.org");
    expect(brandText("See https://eleventhpress.com/resources", RON)).toBe(`See ${RON.baseUrl}/resources`);
    expect(brandText("as set out in EP-G-02", RON)).toBe("as set out in G-02");
    expect(brandText("mail editorial@eleventhpress.com", { ...RON, email: null })).toBe("mail the editorial office");
  });

  test("no Eleventh Press identity is left in any branded guide", () => {
    for (const meta of GUIDES) {
      const g = getGuideDoc(meta.slug, RON)!;
      const { standards, ...rest } = g;
      const text = JSON.stringify(rest) + JSON.stringify(standards.map(({ url: _url, ...s }) => s));
      expect(text).not.toMatch(/Eleventh Press|eleventhpress\.com|EP-G-/);
      expect(g.slug).toBe(meta.slug);
      expect(g.code).toBe(meta.code.replace(/^EP-/, ""));
      expect(guideCitation(g, RON)).toStartWith("Ron International Publishing. (");
    }
  });

  test("contact line shows only what the tenant set, never the pending-ISSN label", () => {
    expect(brandContactLine(RON)).toBe("Cebu, Philippines · editor@ron.example.org");
    expect(brandContactLine(PLATFORM_RESOURCE_BRAND)).toContain("ISSN: applied for");
  });
});
