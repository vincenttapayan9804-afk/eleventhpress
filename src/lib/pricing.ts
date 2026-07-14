/**
 * Single source of truth for every dollar amount charged anywhere in the
 * platform (APC, reader subscriptions). UI copy and billing routes both
 * import from here instead of hardcoding amounts, so a price change never
 * goes stale in one place while updating in another.
 */

export const APC_USD = 97.0;

export const SUBSCRIPTION_PLAN_PRICES = {
  READER_MONTHLY: 10.0,
  READER_YEARLY: 97.0,
  INSTITUTIONAL: 997.0,
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLAN_PRICES;

export const SUBSCRIPTION_PLAN_DURATIONS: Record<SubscriptionPlan, number> = {
  READER_MONTHLY: 30,
  READER_YEARLY: 365,
  INSTITUTIONAL: 365,
};

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  READER_MONTHLY: "Monthly",
  READER_YEARLY: "Yearly",
  INSTITUTIONAL: "Institutional (per year)",
};

// One-time Distribution Package add-on (src/lib/distribution.ts /
// src/lib/book-distribution.ts) — unlocks Tier B professional-grade
// submission packages (arXiv/SSRN for articles, Draft2Digital/IngramSpark
// for books). Tier C self-serve share kits and Tier A Blogger auto-publish
// stay free — this only gates the higher-effort, higher-value formatting.
export const DISTRIBUTION_PACKAGE_ARTICLE_USD = 19.0;
export const DISTRIBUTION_PACKAGE_BOOK_USD = 29.0;
