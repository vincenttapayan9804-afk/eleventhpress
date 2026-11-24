import { describe, expect, test } from "bun:test";
import { parseCcLicence } from "./licence-badge";

describe("parseCcLicence", () => {
  test("reads the platform default", () => {
    const l = parseCcLicence("CC BY 4.0")!;
    expect(l.elements).toEqual(["BY"]);
    expect(l.version).toBe("4.0");
    expect(l.label).toBe("CC BY 4.0");
    expect(l.url).toBe("https://creativecommons.org/licenses/by/4.0/");
  });
  test("reads combined elements and an IGO suffix", () => {
    const l = parseCcLicence("CC BY-NC-SA 4.0 IGO")!;
    expect(l.elements).toEqual(["BY", "NC", "SA"]);
    expect(l.suffix).toBe("IGO");
    expect(l.url).toBe("https://creativecommons.org/licenses/by-nc-sa/4.0/igo/");
  });
  test("accepts the hyphenated spelling", () => {
    expect(parseCcLicence("CC-BY-4.0")?.label).toBe("CC BY 4.0");
  });
  test("refuses anything that is not Creative Commons", () => {
    expect(parseCcLicence("All rights reserved")).toBeNull();
    expect(parseCcLicence("")).toBeNull();
    expect(parseCcLicence(null)).toBeNull();
    expect(parseCcLicence("CC0")).toBeNull();
  });
});

import { OPEN_RESOURCES } from "./open-resources";
import { JOURNAL_IDENTITY } from "./site";

describe("badges apply automatically", () => {
  test("the platform default licence is recognised", () => {
    expect(parseCcLicence(JOURNAL_IDENTITY.license)).not.toBeNull();
  });
  test("every current (and future) Open Resource with a CC code gets a badge", () => {
    for (const r of OPEN_RESOURCES) {
      if (/^cc\b/i.test(r.licence.code)) expect(parseCcLicence(r.licence.code), r.slug).not.toBeNull();
    }
  });
});

import { WCAG_CLAIM } from "./wcag-claim";
import { POLICY_SLUGS } from "./policy-pages";

describe("WCAG claim scope", () => {
  test("covers exactly the policy pages and names W3C's own explanation", () => {
    expect(WCAG_CLAIM.pages).toEqual(POLICY_SLUGS.map((s) => `/policies/${s}`));
    expect(WCAG_CLAIM.explanationUrl).toBe("https://www.w3.org/WAI/WCAG2AA-Conformance");
    expect(WCAG_CLAIM.level).toBe("AA");
  });
});
