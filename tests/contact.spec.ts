import { test, expect } from "@playwright/test";

// Every "contact us" style call-to-action opens the site-wide contact form
// instead of a mailto: link (which does nothing without a desktop mail app).
const CTAS = [
  { path: "/trust", testId: "cta-contact-security", title: "Report a security vulnerability" },
  { path: "/accessibility", testId: "cta-contact-accessibility", title: "Report an accessibility barrier" },
  { path: "/privacy", testId: "cta-contact-privacy", title: "Make a data rights request" },
  { path: "/terms", testId: "cta-contact-terms", title: "Ask about the Terms of Service" },
];

for (const c of CTAS) {
  test(`${c.path} CTA opens the contact form`, async ({ page }) => {
    await page.goto(c.path, { waitUntil: "networkidle" });
    const btn = page.getByTestId(c.testId).first();
    // The page can still re-render just after load, detaching the button
    // mid-scroll, so scroll and click together inside the retry.
    await expect(async () => {
      await btn.scrollIntoViewIfNeeded({ timeout: 3000 });
      await btn.click({ timeout: 3000 });
      await expect(page.getByTestId("contact-dialog")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByTestId("contact-dialog").getByRole("heading", { name: c.title })).toBeVisible();
  });
}

test("contact form validates and shows a reference on success", async ({ page }) => {
  await page.route("**/api/contact", (route) =>
    route.fulfill({ json: { ok: true, reference: "EP-GEN-261119-ABCD", responseTime: "within 3 working days", topic: "general" } }),
  );
  await page.goto("/contact", { waitUntil: "networkidle" });
  const form = page.getByTestId("contact-form");
  await form.getByLabel("Your name", { exact: true }).fill("Test Person");
  await form.getByLabel("Email", { exact: true }).fill("test@example.com");
  await form.getByLabel("Message", { exact: true }).fill("A question about the submission process.");
  await form.getByTestId("contact-submit").click();
  await expect(form.getByRole("alert")).toContainText("tick the box");
  await form.getByTestId("contact-consent").click();
  await form.getByTestId("contact-submit").click();
  await expect(page.getByTestId("contact-success")).toContainText("EP-GEN-261119-ABCD");
});
