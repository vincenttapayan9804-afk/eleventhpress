/**
 * One-off cleanup: the platform journal was seeded with an ISSN
 * (2945-1138) and DOI prefix (10.52011) that were never assigned to
 * Eleventh Press. The ISSN is now "applied for" (src/lib/site.ts), so
 * this clears the stored ISSN and moves stored DOIs onto the reserved
 * test prefix 10.5072, which can't be mistaken for a real DOI.
 *
 * Issued certificates keep their snapshot: the ISSN is part of each
 * certificate's sealed hash, and changing it would break verification.
 *
 * Usage:
 *   bun run scripts/clear-unassigned-identifiers.ts
 */
import { db } from "../src/lib/db";

const OLD_ISSN = "2945-1138";
const OLD_PREFIX = "10.52011/";
const TEST_PREFIX = "10.5072/";

const swap = (doi: string) => TEST_PREFIX + doi.slice(OLD_PREFIX.length);

async function main() {
  const issn = await db.journal.updateMany({ where: { issn: OLD_ISSN }, data: { issn: null } });
  const eissn = await db.journal.updateMany({ where: { eissn: OLD_ISSN }, data: { eissn: null } });

  const articles = await db.article.findMany({ where: { doi: { startsWith: OLD_PREFIX } }, select: { id: true, doi: true } });
  for (const a of articles) await db.article.update({ where: { id: a.id }, data: { doi: swap(a.doi!) } });

  const reports = await db.article.findMany({ where: { reviewReportDoi: { startsWith: OLD_PREFIX } }, select: { id: true, reviewReportDoi: true } });
  for (const a of reports) await db.article.update({ where: { id: a.id }, data: { reviewReportDoi: swap(a.reviewReportDoi!) } });

  const notices = await db.correction.findMany({ where: { doi: { startsWith: OLD_PREFIX } }, select: { id: true, doi: true } });
  for (const c of notices) await db.correction.update({ where: { id: c.id }, data: { doi: swap(c.doi!) } });

  console.log(
    `Cleared ISSN on ${issn.count + eissn.count} journal field(s); moved ${articles.length} article, ${reports.length} review-report and ${notices.length} correction DOI(s) to the test prefix.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
