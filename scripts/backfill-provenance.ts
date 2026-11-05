/**
 * Seals (or reseals) the digital provenance of every PUBLISHED article whose
 * seal is missing or predates PROVENANCE_SEAL_VERSION
 * (src/lib/article-provenance.ts). Live paths keep seals current on their
 * own — publish, DOI assignment and galley regeneration all reseal via
 * sealArticleProvenance() — so this is the catch-up for articles sealed
 * before that rule existed, whose later DOI/galley updates left them
 * failing /verify/article/[id] with a hash mismatch.
 *
 * Runs automatically, idempotently, on every production build — package.json
 * calls it right after scripts/backfill-galleys.ts. No billed API calls, just
 * SHA-256 of bytes already in storage; no-ops once every seal is current.
 * Every (re)seal is audit-logged with its previous hash.
 *
 * Usage:
 *   bun run scripts/backfill-provenance.ts                  # dry run
 *   bun run scripts/backfill-provenance.ts --confirm        # seal everything missing/stale
 *   bun run scripts/backfill-provenance.ts --confirm --force    # reseal even if current
 *   bun run scripts/backfill-provenance.ts --confirm --limit 10
 *   bun run scripts/backfill-provenance.ts --confirm --article-id <id>
 */
import { db } from "../src/lib/db";
import { sealArticleProvenance } from "../src/lib/article-provenance-server";
import { PROVENANCE_SEAL_VERSION } from "../src/lib/article-provenance";

function flagValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return null;
  return args[idx + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");
  const articleId = flagValue(args, "--article-id");
  const limitArg = flagValue(args, "--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const candidates = await db.article.findMany({
    where: articleId ? { id: articleId, status: "PUBLISHED" } : { status: "PUBLISHED" },
    select: { id: true, title: true, contentHash: true, provenanceVersion: true },
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  const targets = candidates.filter(
    (a) => force || !a.contentHash || a.provenanceVersion < PROVENANCE_SEAL_VERSION
  );

  console.log(`Found ${candidates.length} published article(s)${articleId ? " (single-article mode)" : ""}.`);
  console.log(`${targets.length} need a provenance seal (missing, or older than seal v${PROVENANCE_SEAL_VERSION}):`);
  for (const a of targets) {
    console.log(`  - [${a.id}] "${a.title}" (${a.contentHash ? `reseal from v${a.provenanceVersion}` : "unsealed"})`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    console.log(`\nDry run only — no changes made. Re-run with --confirm to seal ${targets.length} article(s).`);
    return;
  }

  console.log(`\n--confirm passed. Sealing ${targets.length} article(s)...\n`);

  const failures: { id: string; title: string }[] = [];
  for (const article of targets) {
    try {
      const sealed = await sealArticleProvenance(
        article.id,
        force ? "backfill-forced" : article.contentHash ? `backfill-seal-v${PROVENANCE_SEAL_VERSION}` : "backfill-initial"
      );
      console.log(`  [${article.id}] sealed (contentHash=${sealed?.contentHash.slice(0, 12)}…)`);
    } catch (error) {
      console.error(`  FAILED [${article.id}] "${article.title}":`, error);
      failures.push({ id: article.id, title: article.title });
    }
  }

  console.log(`\nDone. ${targets.length - failures.length}/${targets.length} article(s) sealed.`);
  if (failures.length > 0) {
    console.log(`${failures.length} failure(s) — left as-is for the next deploy to retry:`);
    for (const f of failures) console.log(`  - [${f.id}] "${f.title}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
