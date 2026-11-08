import { APC_USD, DISTRIBUTION_PACKAGE_ARTICLE_USD, DISTRIBUTION_PACKAGE_BOOK_USD, SUBSCRIPTION_PLAN_PRICES } from "./pricing";

/**
 * Reader plans as presented to people — names, prices, features. Shared by
 * the public Pricing page and the dashboard's Reader subscription tab, so
 * both always describe the same plans at the prices in pricing.ts.
 */
export const READER_PLANS = [
  {
    id: "READER_MONTHLY" as const,
    name: "Monthly Reader",
    price: SUBSCRIPTION_PLAN_PRICES.READER_MONTHLY,
    period: "month",
    description: "Convenience features on top of already-free PDF access, for active readers and visiting researchers.",
    features: ["Bundled/batch PDF downloads", "Full-text search across all articles", "Email alerts for new issues", "Cancel anytime"],
    popular: false,
  },
  {
    id: "READER_YEARLY" as const,
    name: "Annual Reader",
    price: SUBSCRIPTION_PLAN_PRICES.READER_YEARLY,
    period: "year",
    description: "Best value for active scholars and doctoral candidates.",
    features: [
      "Everything in Monthly",
      "Save ~19% vs. monthly billing",
      "Early access to forthcoming articles",
      "Citation export in BibTeX / RIS / APA",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "INSTITUTIONAL" as const,
    name: "Institutional",
    price: SUBSCRIPTION_PLAN_PRICES.INSTITUTIONAL,
    period: "year",
    description: "Site-wide access for libraries, universities, and research institutes.",
    features: ["Everything in Annual", "IP-range or SSO authentication", "Unlimited concurrent users", "COUNTER 5 usage reports", "Dedicated account manager"],
    popular: false,
  },
];

export const AUTHOR_FEES = [
  {
    name: "Article Processing Charge",
    price: APC_USD,
    when: "Only if your article is accepted",
    detail:
      "Covers typesetting, a permanent DOI, archiving and indexing. Nothing is charged at submission or if your manuscript is declined. Waivers are available on request.",
  },
  {
    name: "Article distribution package",
    price: DISTRIBUTION_PACKAGE_ARTICLE_USD,
    when: "Optional, one-time",
    detail: "Professionally formatted submission packages for preprint servers such as arXiv and SSRN.",
  },
  {
    name: "Book distribution package",
    price: DISTRIBUTION_PACKAGE_BOOK_USD,
    when: "Optional, one-time",
    detail: "Retail-ready files for distributors such as Draft2Digital and IngramSpark.",
  },
];

export const usd = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
