import { test, expect } from "@playwright/test";

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
  await page.getByRole("link", { name: /^About$/ }).first().click();
  await expect(page).toHaveURL(/\/about$/);
  await page.getByRole("link", { name: /^FAQs$/ }).first().click();
  await expect(page).toHaveURL(/\/faqs$/);
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
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByPlaceholder(/Search articles/)).toBeVisible();
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
