/**
 * One-off cleanup: the first seed gave each sample account a made-up
 * ORCID iD (0000-0002-1001-0010 … 0015). They point at nobody, yet the
 * public Editorial Board showed them as real links. This clears exactly
 * those values from user accounts, along with any citation metrics cached
 * for them, so the board shows no ORCID until a member adds their own.
 *
 * A member who has since entered a real ORCID is untouched: only the six
 * placeholder values are matched.
 *
 * Usage:
 *   bun run scripts/clear-placeholder-orcids.ts
 */
import { db } from "../src/lib/db";

export const PLACEHOLDER_ORCIDS = [
  "0000-0002-1001-0010",
  "0000-0002-1001-0011",
  "0000-0002-1001-0012",
  "0000-0002-1001-0013",
  "0000-0002-1001-0014",
  "0000-0002-1001-0015",
];

async function main() {
  const { count } = await db.user.updateMany({
    where: { orcid: { in: PLACEHOLDER_ORCIDS } },
    data: {
      orcid: null,
      boardWorksCount: null,
      boardCitedByCount: null,
      boardHIndex: null,
      boardMetricsCheckedAt: null,
    },
  });
  console.log(`Cleared placeholder ORCID iDs from ${count} account(s).`);
}

if (import.meta.main) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
