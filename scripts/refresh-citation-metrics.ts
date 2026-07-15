/**
 * Refreshes the real citation metrics that replace `Article.citations`'s
 * former "mock analytics" value: real per-article citation counts +
 * year-percentile from OpenAlex (src/lib/citation-metrics.ts), and real
 * scholarly-output metrics (works count, total citations, h-index) for
 * every editorial-board account (SUPER_ADMIN/EDITOR/ASSOCIATE_EDITOR) that
 * has an ORCID on file.
 *
 * Unlike scripts/backfill-galleys.ts, this is NOT an idempotent "skip once
 * already set" backfill — a citation count keeps changing after it's first
 * fetched, so every run re-fetches every eligible row. Runs unconditionally,
 * unattended, on every production build (package.json's "build" script),
 * the same precedent already used for scripts/seed.ts and
 * scripts/backfill-galleys.ts: a script with real DB/API access and no
 * sandbox equivalent, wrapped in `|| true` so a transient OpenAlex failure
 * never blocks deployment.
 *
 * Deliberately sequential with a short delay between requests — this is an
 * unattended build-time job, not a user-facing request, so there's no
 * reason to burn through OpenAlex's rate limit budget faster than needed.
 *
 * Usage:
 *   bun run scripts/refresh-citation-metrics.ts            # dry run
 *   bun run scripts/refresh-citation-metrics.ts --confirm   # write results
 *   bun run scripts/refresh-citation-metrics.ts --confirm --limit 20
 */
import { db } from "../src/lib/db";
import { fetchWorkCitationMetrics, fetchAuthorCitationMetrics } from "../src/lib/citation-metrics";

const REQUEST_DELAY_MS = 150; // polite pacing, not a rate-limit workaround
const BOARD_ROLES = ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"];

function flagValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return null;
  return args[idx + 1];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const limitArg = flagValue(args, "--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const articles = await db.article.findMany({
    where: { status: "PUBLISHED", doi: { not: null } },
    select: { id: true, title: true, doi: true },
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  const boardMembers = await db.user.findMany({
    where: { role: { in: BOARD_ROLES }, orcid: { not: null } },
    select: { id: true, fullName: true, orcid: true },
  });

  console.log(`Refreshing citation metrics for ${articles.length} published article(s) and ${boardMembers.length} editorial-board account(s) with an ORCID.`);
  if (!confirm) {
    console.log("\nDry run only — no changes made. This will make real, billed-free but rate-limited calls to the public OpenAlex API.");
    console.log("Re-run with --confirm to write results.");
    return;
  }

  let articlesUpdated = 0;
  let articlesUnavailable = 0;
  for (const article of articles) {
    const metrics = await fetchWorkCitationMetrics(article.doi!);
    if (metrics) {
      await db.article.update({
        where: { id: article.id },
        data: {
          citations: metrics.citedByCount,
          citationsCheckedAt: new Date(metrics.fetchedAt),
          citationsPercentileMin: metrics.percentileYearMin,
          citationsPercentileMax: metrics.percentileYearMax,
        },
      });
      articlesUpdated++;
      console.log(`  [${article.id}] "${article.title}" → ${metrics.citedByCount} citation(s)`);
    } else {
      articlesUnavailable++;
      console.log(`  [${article.id}] "${article.title}" → not yet indexed by OpenAlex`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  let boardUpdated = 0;
  let boardUnavailable = 0;
  for (const member of boardMembers) {
    const metrics = await fetchAuthorCitationMetrics(member.orcid!);
    if (metrics) {
      await db.user.update({
        where: { id: member.id },
        data: {
          boardWorksCount: metrics.worksCount,
          boardCitedByCount: metrics.citedByCount,
          boardHIndex: metrics.hIndex,
          boardMetricsCheckedAt: new Date(metrics.fetchedAt),
        },
      });
      boardUpdated++;
      console.log(`  [${member.id}] ${member.fullName} → h-index ${metrics.hIndex ?? "—"}, ${metrics.citedByCount} citation(s)`);
    } else {
      boardUnavailable++;
      console.log(`  [${member.id}] ${member.fullName} → no OpenAlex author record found for this ORCID`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\nDone. Articles: ${articlesUpdated} updated, ${articlesUnavailable} not yet indexed. ` +
      `Board accounts: ${boardUpdated} updated, ${boardUnavailable} unavailable.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
