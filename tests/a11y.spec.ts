import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated WCAG 2.2 AA scan (axe-core) over the static, database-free
 * pages — see playwright.config.ts for why the scope stops there. This is
 * a real, running check against rendered HTML, not a certification: axe
 * catches a meaningful subset of accessibility issues (missing labels,
 * contrast, ARIA misuse, etc.) but not everything WCAG covers — see
 * docs/accessibility.md.
 */
const PAGES: { name: string; path: string }[] = [
  { name: "home", path: "/" },
];

for (const { name, path } of PAGES) {
  test(`${name} has no automatically-detectable accessibility violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        `[a11y] ${name} (${path}): ${results.violations.length} violation type(s)\n` +
          results.violations
            .map((v) => `  - ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
            .join("\n")
      );
    }
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
