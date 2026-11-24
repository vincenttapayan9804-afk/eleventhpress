/**
 * Machine-readable pointers (schema.org) from the organization to the pages
 * that state its editorial policies. Search engines and the Journalism Trust
 * Initiative's checkers read these from the home page's structured data.
 *
 * Every URL must be a real, public page. There is no dedicated ownership
 * page yet, so ownership points at the About page, which names the
 * publisher; repoint it when a dedicated page exists.
 */
export function policySignals(base: string) {
  const editorial = `${base}/policies/editorial-standards`;
  return {
    publishingPrinciples: editorial,
    correctionsPolicy: editorial,
    ethicsPolicy: `${base}/charter`,
    actionableFeedbackPolicy: editorial,
    ownershipFundingInfo: `${base}/about`,
    hasPart: [
      { "@type": "WebPage", name: "Editorial standards", url: editorial },
      { "@type": "WebPage", name: "Mission & values", url: `${base}/policies/editorial-mission` },
      { "@type": "WebPage", name: "Staff & contributors", url: `${base}/policies/staff-contributors` },
      { "@type": "WebPage", name: "Publication Charter", url: `${base}/charter` },
    ],
  };
}
