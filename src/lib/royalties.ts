/**
 * Royalty payout math for book sales reported through
 * POST /api/books/[id]/royalties (see prisma/schema.prisma's
 * RoyaltyStatement model doc for why this is staff-entered rather than
 * pulled live from an aggregator API). Pure function — no DB access — so
 * it's directly unit-testable and shared by the route so the number stored
 * on a RoyaltyStatement always matches this exact rounding rule.
 */
export function computeAuthorPayout(grossRevenue: number, royaltySharePercent: number): number {
  return Math.round(grossRevenue * (royaltySharePercent / 100) * 100) / 100;
}
