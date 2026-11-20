import { test, expect, type Page } from "@playwright/test";

/**
 * Core public flows, database-free so they run in CI (ci.yml's Playwright
 * job): every page has its own address, Back/Forward work, unknown paths
 * are real 404s, and the search palette, pricing, unsubscribe and status
 * pages render.
 */

test.beforeEach(async ({ context }) => {
  // Keep the cookie banner out of the way of the clicks below.
  await context.addInitScript(() => localStorage.setItem("epip-cookie-consent", JSON.stringify({ necessary: true })));
});

test("a direct visit opens that page with its own title", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle(/^About — /);
  await expect(page).toHaveURL(/\/about$/);
});

test("navigation updates the address and Back/Forward follow it", async ({ page }) => {
  await page.goto("/");
  // About us and FAQs sit in the header's "About" dropdown.
  await page.getByTestId("nav-group-about").click();
  await page.getByTestId("nav-about").click();
  await expect(page).toHaveURL(/\/about$/);
  // The About view is still settling under `next dev`; reopen the menu
  // until the FAQs item is there to click.
  await expect(async () => {
    if (!(await page.getByTestId("nav-faqs").isVisible())) await page.getByTestId("nav-group-about").click();
    await page.getByTestId("nav-faqs").click({ timeout: 2000 });
    await expect(page).toHaveURL(/\/faqs$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/faqs$/);
});

test("refresh keeps the current page", async ({ page }) => {
  await page.goto("/faqs");
  await page.reload();
  await expect(page).toHaveURL(/\/faqs$/);
  await expect(page).toHaveTitle(/^FAQs — /);
});

test("unknown paths are a real 404", async ({ page }) => {
  const res = await page.goto("/definitely-not-a-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /This page isn.t here/ })).toBeVisible();
});

test("pricing page lists the plans", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: /Open to read/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose Annual Reader/ })).toBeVisible();
});

test("the search palette opens with the keyboard", async ({ page }) => {
  await page.goto("/about");
  // The shortcut listener attaches on hydration, which under `next dev` can
  // land after goto() resolves; retry the keypress until the palette opens
  // instead of failing on a press that happened before the listener existed.
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder(/Search articles/)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder(/Search articles/)).toBeHidden();
});

test("an invalid unsubscribe link explains itself", async ({ page }) => {
  await page.goto("/unsubscribe?token=bad");
  await expect(page.getByRole("heading", { name: /This link isn.t valid/ })).toBeVisible();
});

test("the status page renders", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Platform status" })).toBeVisible();
});

// Opens the header's About menu unless it's already open. Checking the
// trigger's aria-expanded (not item visibility) avoids clicking it again
// mid-animation, which would close the menu.
async function openAboutMenu(page: Page) {
  const trigger = page.getByTestId("nav-group-about");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}

test("the About menu opens each Governance and Legal page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/", { waitUntil: "networkidle" });
  const pages: [string, RegExp][] = [
    ["nav-charter", /\/charter$/],
    ["nav-accessibility", /\/accessibility$/],
    ["nav-terms", /\/terms$/],
    ["nav-privacy", /\/privacy$/],
  ];
  for (const [id, url] of pages) {
    await expect(async () => {
      await openAboutMenu(page);
      await page.getByTestId(id).click({ timeout: 5000 });
      await expect(page).toHaveURL(url, { timeout: 3000 });
    }).toPass({ timeout: 30_000 });
  }
});

test("the About menu shows labelled sections and links the Cookie Policy", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/", { waitUntil: "networkidle" });
  const menu = page.getByRole("menu");
  const cookie = page.getByTestId("nav-cookie-policy");
  await expect(async () => {
    await openAboutMenu(page);
    for (const heading of ["About", "Governance", "Legal"]) await expect(menu.getByText(heading, { exact: true })).toBeVisible({ timeout: 3000 });
    await expect(cookie).toHaveAttribute("href", "/cookie-policy", { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  // The Cookie Policy is a server-rendered page, so the click starts a full
  // page load (slow on first compile under `next dev`): click, then wait.
  await expect(async () => {
    await openAboutMenu(page);
    await cookie.click({ timeout: 5000, noWaitAfter: true });
  }).toPass({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/cookie-policy$/, { timeout: 60_000 });
});

test("the homepage search carries the typed query to the Articles page", async ({ page }) => {
  test.setTimeout(90_000);
  for (const submit of ["button", "enter"] as const) {
    await page.goto("/", { waitUntil: "networkidle" });
    const input = page.getByTestId("hero-search-input");
    await input.fill("peer review ethics");
    if (submit === "button") await page.getByTestId("hero-search-submit").click();
    else await input.press("Enter");
    await expect(page).toHaveURL(/\/articles$/, { timeout: 15_000 });
    await expect(page.getByRole("textbox", { name: "Search articles" })).toHaveValue("peer review ethics", { timeout: 15_000 });
  }
});

test("a homepage discipline card opens Articles filtered to that discipline", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByTestId("home-discipline-Computer Science").click();
  await expect(page).toHaveURL(/\/articles$/, { timeout: 15_000 });
  await expect(page.getByTestId("browse-discipline")).toContainText("Computer Science", { timeout: 15_000 });
});
