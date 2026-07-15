/**
 * Deletes the sample/seed articles created by scripts/seed.ts (10 fake
 * articles under the single seed author account, author@eleventhpress.org)
 * without touching any real submission, User, Journal, or Issue row.
 *
 * scripts/seed.ts's main() guards on an existing Journal row and no-ops on
 * every build past the first, so deleting these rows is durable — they
 * will not be recreated by a future deploy.
 *
 * Usage:
 *   bun run scripts/remove-seed-articles.ts                    # dry run
 *   bun run scripts/remove-seed-articles.ts --confirm           # delete
 *   bun run scripts/remove-seed-articles.ts --confirm --delete-files
 *   bun run scripts/remove-seed-articles.ts --include-seed-author  # also
 *     surface (never auto-delete) any other article by the seed author
 */
import { db } from "../src/lib/db";
import { deleteArticleCascade } from "../src/lib/article-delete";

const SEED_AUTHOR_EMAIL = "author@eleventhpress.org";

// Verbatim from scripts/seed.ts's ARTICLES array.
const SEED_TITLES = [
  "Topological Signatures in Strain-Engineered Transition Metal Dichalcogenides",
  "CRISPR-Cas12a Base Editing Rescues Splicing Defects in a Cellular Model of Cystic Fibrosis",
  "Sparse Mixture-of-Experts Routing for Resource-Constrained Edge Inference",
  "Gentrification, Displacement, and the Informal Care Economy in Post-2010 Lisbon",
  "Carbon Border Adjustment Mechanisms: A General Equilibrium Assessment of Distributional Effects",
  "Attentional Bias Modification in Subclinical Anxiety: A Pre-Registered Multi-Site Replication",
  "Reconstructing Seasonal Snowpack Trends in the Hindu Kush-Karakoram from Sentinel-2 Time Series",
  "A Refined Bound for the Sum-of-Digits Function in Modular Arithmetic",
  "Quantum Metrology with Squeezed-Vacuum-Enhanced Mach-Zehnder Interferometers",
  "Microplastic Loads in Urban Stormwater Biofilters: A Six-City Comparative Audit",
];

interface ChildCounts {
  [table: string]: number;
}

async function countChildren(articleId: string): Promise<ChildCounts> {
  const [
    corrections,
    references,
    reviews,
    decisions,
    invoices,
    notifications,
    auditLogs,
    distributions,
    bookArticles,
    datasetLinks,
    embeddings,
    triageReports,
    galleyJobs,
    integrityJobs,
    altTextJobs,
    storageObjects,
    counterEvents,
  ] = await Promise.all([
    db.correction.count({ where: { articleId } }),
    db.reference.count({ where: { articleId } }),
    db.review.count({ where: { articleId } }),
    db.editorialDecision.count({ where: { articleId } }),
    db.invoice.count({ where: { articleId } }),
    db.notification.count({ where: { articleId } }),
    db.auditLog.count({ where: { articleId } }),
    db.distribution.count({ where: { articleId } }),
    db.bookArticle.count({ where: { articleId } }),
    db.datasetLink.count({ where: { articleId } }),
    db.articleEmbedding.count({ where: { articleId } }),
    db.editorialTriageReport.count({ where: { articleId } }),
    db.galleyJob.count({ where: { articleId } }),
    db.integrityCheckJob.count({ where: { articleId } }),
    db.altTextJob.count({ where: { articleId } }),
    db.storageObject.count({ where: { articleId } }),
    db.counterEvent.count({ where: { articleId } }),
  ]);
  return {
    corrections,
    references,
    reviews,
    decisions,
    invoices,
    notifications,
    auditLogs,
    distributions,
    bookArticles,
    datasetLinks,
    embeddings,
    triageReports,
    galleyJobs,
    integrityJobs,
    altTextJobs,
    storageObjects,
    counterEvents,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const deleteFiles = args.includes("--delete-files");
  const includeSeedAuthor = args.includes("--include-seed-author");

  const seedAuthor = await db.user.findUnique({ where: { email: SEED_AUTHOR_EMAIL } });

  const titleMatches = await db.article.findMany({
    where: { title: { in: SEED_TITLES } },
    include: { author: { select: { email: true } } },
  });

  const toDelete: typeof titleMatches = [];
  const skippedAuthorMismatch: typeof titleMatches = [];

  for (const article of titleMatches) {
    if (seedAuthor && article.correspondingAuthorId === seedAuthor.id) {
      toDelete.push(article);
    } else {
      skippedAuthorMismatch.push(article);
    }
  }

  console.log(`Found ${titleMatches.length} article(s) matching known seed titles.`);
  if (skippedAuthorMismatch.length > 0) {
    console.log(
      `\nWARNING: ${skippedAuthorMismatch.length} title-matched article(s) have a different corresponding author than the seed account (${SEED_AUTHOR_EMAIL}) — leaving these alone:`
    );
    for (const a of skippedAuthorMismatch) {
      console.log(`  - [${a.id}] "${a.title}" (author: ${a.author?.email ?? "unknown"})`);
    }
  }

  console.log(`\n${toDelete.length} article(s) confirmed as seed data (title + author match):\n`);
  for (const a of toDelete) {
    const counts = await countChildren(a.id);
    const childSummary = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}=${n}`)
      .join(", ");
    console.log(
      `  [${a.id}] "${a.title}"\n` +
        `    status=${a.status} doi=${a.doi ?? "none"} doiStatus=${a.doiStatus} createdAt=${a.createdAt.toISOString()}\n` +
        `    children: ${childSummary || "(none)"}`
    );
  }

  if (includeSeedAuthor && seedAuthor) {
    const otherByAuthor = await db.article.findMany({
      where: {
        correspondingAuthorId: seedAuthor.id,
        title: { notIn: SEED_TITLES },
      },
    });
    if (otherByAuthor.length > 0) {
      console.log(
        `\nAdditional matches by seed author (NOT a known seed title, NOT auto-deleted — review manually):`
      );
      for (const a of otherByAuthor) {
        console.log(`  - [${a.id}] "${a.title}" status=${a.status} createdAt=${a.createdAt.toISOString()}`);
      }
    } else {
      console.log(`\n--include-seed-author: no additional articles found under the seed author account.`);
    }
  }

  if (toDelete.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  if (!confirm) {
    console.log(
      `\nDry run only — no rows deleted. Re-run with --confirm to delete ${toDelete.length} article(s) and their related rows.` +
        (deleteFiles ? "" : " Add --delete-files to also purge the associated Blob/storage files.")
    );
    return;
  }

  console.log(`\n--confirm passed. Deleting ${toDelete.length} article(s)...\n`);

  const failures: { id: string; title: string; error: unknown }[] = [];

  for (const article of toDelete) {
    try {
      await deleteArticleCascade(article, { deleteFiles });
      console.log(`  Deleted [${article.id}] "${article.title}"${deleteFiles ? " (and associated files)" : ""}`);
    } catch (error) {
      console.error(`  FAILED to delete [${article.id}] "${article.title}":`, error);
      failures.push({ id: article.id, title: article.title, error });
    }
  }

  console.log(`\nDone. ${toDelete.length - failures.length}/${toDelete.length} article(s) deleted.`);
  if (failures.length > 0) {
    console.log(`${failures.length} failure(s):`);
    for (const f of failures) {
      console.log(`  - [${f.id}] "${f.title}"`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
