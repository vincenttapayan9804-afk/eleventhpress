import { POLICY_SLUGS } from "@/lib/policy-pages";

/**
 * The scope of our WCAG conformance claim. W3C's conformance logo applies to a
 * single page unless the claim names the pages it covers, and it is only honest
 * where a page meets every Level A and AA criterion. The platform as a whole
 * does not (see src/lib/accessibility-conformance.ts, which lists criteria that
 * are only partly supported), so the claim is limited to the pages below: plain
 * text policy pages with no video, audio, drag-and-drop or interactive charts.
 *
 * Every page here is scanned by tests/a11y.spec.ts on each change (blocking in
 * CI), which is why the list is built from POLICY_SLUGS: a newly added policy
 * page is scanned automatically, and the scan fails the build if it has a
 * detectable problem.
 */
export const WCAG_CLAIM = {
  version: "2.2",
  level: "AA",
  /** When the pages were last evaluated by hand as well as by the automated scan. */
  evaluatedOn: "24 November 2026",
  explanationUrl: "https://www.w3.org/WAI/WCAG2AA-Conformance",
  logoSrc: "/badges/wcag2.2AA.svg",
  alt: "Level AA conformance, W3C Web Content Accessibility Guidelines 2.2",
  pages: POLICY_SLUGS.map((slug) => `/policies/${slug}`),
} as const;
