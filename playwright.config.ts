import { defineConfig } from "@playwright/test";

/**
 * Config for the automated accessibility scan (tests/a11y.spec.ts) only —
 * this project has no other Playwright suite. Most of this app has no
 * distinct URL per view — it's a client-side SPA switching zustand state
 * under "/" (see src/app/page.tsx) — so tests/a11y.spec.ts reaches the
 * static public views (Home, About, FAQs, Policies, Privacy, Terms,
 * Accessibility) by clicking their nav triggers from "/" rather than
 * visiting a separate URL for each. The only real, independently
 * routable public URLs beyond that are /article/[id] and a few one-off
 * pages, all of which need real database rows CI's Postgres doesn't have
 * (see ci.yml — no schema push or seed there) to render anything other
 * than a 404/error state, which wouldn't be a meaningful scan — those
 * stay out of scope for this database-free automated check.
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
