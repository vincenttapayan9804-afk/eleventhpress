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

/** Window event that reopens the cookie preferences dialog (footer, Cookie Policy page). */
export const OPEN_COOKIE_PREFERENCES_EVENT = "epip:open-cookie-preferences";

export function openCookiePreferences() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}

/** Window event fired after the visitor saves a cookie choice. */
export const COOKIE_CONSENT_CHANGED_EVENT = "epip:cookie-consent-changed";

/** Date the cookie policy text and inventory below last changed (ISO). */
export const COOKIE_POLICY_UPDATED = "2026-11-05";

export type CookieCategory = "necessary" | "preferences" | "metering" | "analytics";

export interface CookieCategoryInfo {
  id: CookieCategory;
  label: string;
  description: string;
  /** Always on — can't be declined. */
  required: boolean;
  /** No cookie or storage in this category is used at all. */
  unused?: boolean;
}

export const COOKIE_CATEGORIES: CookieCategoryInfo[] = [
  {
    id: "necessary",
    label: "Strictly necessary",
    description:
      "Keep you signed in, protect forms against cross-site request forgery, complete ORCID and Blogger sign-in safely, and remember this cookie choice. The site can't work without them, so they can't be switched off.",
    required: true,
  },
  {
    id: "preferences",
    label: "Preferences",
    description:
      "Remember choices you make yourself — light or dark theme, interface language, the dashboard sidebar's open/closed state. Stored only on your device and never shared.",
    required: true,
  },
  {
    id: "metering",
    label: "Reader metering",
    description:
      "One optional cookie for readers who aren't signed in, used only to count free magazine articles per month. Decline it and anonymous magazine reading simply stays uncounted — nothing is blocked.",
    required: false,
  },
  {
    id: "analytics",
    label: "Analytics & advertising",
    description:
      "Not used. This platform runs no advertising, cross-site tracking or third-party analytics cookies.",
    required: false,
    unused: true,
  },
];

export interface CookieInventoryItem {
  name: string;
  category: CookieCategory;
  kind: "Cookie" | "Local storage" | "Session storage";
  purpose: string;
  duration: string;
}

/** Every cookie and browser-storage key this platform sets. All first-party. */
export const COOKIE_INVENTORY: CookieInventoryItem[] = [
  { name: "epip_session", category: "necessary", kind: "Cookie", purpose: "Keeps you signed in (HTTP-only, not readable by scripts). Each whitelabel portal on this site keeps its own (epip_session__<portal>), so signing in or out of one never affects another.", duration: "7 days" },
  { name: "epip_csrf", category: "necessary", kind: "Cookie", purpose: "Security token that stops other sites submitting forms as you.", duration: "7 days" },
  { name: "cookie_consent", category: "necessary", kind: "Cookie", purpose: "Remembers the cookie choice you made here.", duration: "1 year" },
  { name: "orcid_oauth_state", category: "necessary", kind: "Cookie", purpose: "One-time value that secures signing in with ORCID.", duration: "10 minutes" },
  { name: "blogger_oauth_state, blogger_oauth_user", category: "necessary", kind: "Cookie", purpose: "One-time values that secure connecting a Blogger account.", duration: "10 minutes" },
  { name: "epip-session", category: "preferences", kind: "Local storage", purpose: "Your interface language and a cached copy of your signed-in profile, so pages render straight away.", duration: "Until you sign out or clear site data" },
  { name: "theme", category: "preferences", kind: "Local storage", purpose: "Light, dark or system theme.", duration: "Until you clear site data" },
  { name: "sidebar_state", category: "preferences", kind: "Cookie", purpose: "Whether the dashboard sidebar is expanded.", duration: "7 days" },
  { name: "epip-research-assistant", category: "preferences", kind: "Local storage", purpose: "Your AI Research Assistant conversations when you aren't signed in, kept only in this browser. You can turn this off or clear it in the assistant.", duration: "Until you delete them, or 12 months without use" },
  { name: "epip-reader-session-id", category: "preferences", kind: "Session storage", purpose: "Random per-tab ID for the live “people reading now” count on articles.", duration: "Until the tab closes" },
  { name: "reader_key", category: "metering", kind: "Cookie", purpose: "Random ID for an anonymous reader, used only for the monthly free magazine article count. Set only if you accept it.", duration: "1 year" },
];
