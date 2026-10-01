/**
 * Cookie consent constants — deliberately free of any server-only import
 * (`db`, Node's `crypto`, etc.) so this file is safe to import from both
 * the client banner (src/components/cookie-consent-banner.tsx) and server
 * routes that need to read the visitor's choice (src/app/api/magazine-
 * issues/[id]/route.ts). Same split rationale as src/lib/certificates.ts's
 * own doc comment: a `db` import here would get bundled into client JS the
 * moment anything imports this module, and unconditionally throw in the
 * browser.
 */

export const COOKIE_CONSENT_COOKIE_NAME = "cookie_consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export const COOKIE_CONSENT_CHOICES = ["all", "necessary"] as const;
export type CookieConsentChoice = (typeof COOKIE_CONSENT_CHOICES)[number];

export function isCookieConsentChoice(value: string | undefined | null): value is CookieConsentChoice {
  return value === "all" || value === "necessary";
}
