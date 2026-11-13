import { defineConfig } from "@playwright/test";

/**
 * Browser test suites, all database-free so they run in CI (ci.yml):
 * - tests/a11y.spec.ts — automated accessibility scan of the static views;
 * - tests/navigation.spec.ts — core public flows: per-page URLs, Back /
 *   Forward / refresh, real 404s, pricing, the ⌘K search palette, and the
 *   unsubscribe and status pages.
 * Pages that need database rows (articles, dashboards) stay out of scope.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    // PLAYWRIGHT_CHROMIUM_PATH lets a sandbox with a pre-installed,
    // version-pinned Chromium point here instead of Playwright trying to
    // download its own (CI installs its own via `playwright install`
    // instead — see .github/workflows/a11y.yml).
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
