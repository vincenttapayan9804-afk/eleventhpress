import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POLICY_SLUGS, isPolicySlug, policyPages } from "./policy-pages";

const pages = policyPages("Test Press", "editor@test.example");

describe("footer policy pages", () => {
  test("every slug has a complete page", () => {
    for (const slug of POLICY_SLUGS) {
      const page = pages[slug];
      expect(page.slug).toBe(slug);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.highlights.length).toBe(4);
      expect(page.sections.length).toBeGreaterThanOrEqual(5);
      expect(page.related.length).toBeGreaterThan(0);
    }
  });

  test("uses the visiting site's name and contact, never a hard-coded brand", () => {
    for (const slug of POLICY_SLUGS) {
      const text = JSON.stringify(pages[slug]);
      expect(text).not.toContain("Eleventh Press");
    }
    expect(pages["open-access"].summary).toContain("Test Press");
    expect(JSON.stringify(pages["payment-security"])).toContain("editor@test.example");
  });

  test("rejects unknown topics", () => {
    expect(isPolicySlug("peer-review")).toBe(true);
    expect(isPolicySlug("nope")).toBe(false);
  });

  test("the footer links to every policy page", () => {
    const footer = readFileSync(join(import.meta.dir, "../components/site-footer.tsx"), "utf8");
    for (const slug of POLICY_SLUGS) expect(footer).toContain(`href="/policies/${slug}"`);
  });
});
