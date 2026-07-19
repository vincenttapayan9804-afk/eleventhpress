/**
 * Backfill for PUBLISHED articles missing a digital provenance seal
 * (Article.contentHash) — sealing now happens automatically at publish
 * time (src/app/api/articles/workflow/route.ts), but articles published
 * before that feature shipped predate it and need a one-time catch-up.
 *
 * Reuses the exact same hashing logic as the live publish path
 * (src/lib/article-provenance.ts / article-provenance-server.ts) rather
 * than duplicating it — hashes the actual PDF/EPUB bytes currently in
 * storage plus the record's locked-in metadata, exactly like a fresh
 * publish would.
 *
 * Runs automatically, idempotently, on every production build —
 * package.json's "build" script calls this right after
 * scripts/backfill-galleys.ts, the same precedent (a script that runs on
 * every Vercel deploy with real DB/storage credentials and no-ops once
 * nothing is missing). Unlike the glossary/lay-summary backfill, this
 * makes no billed API calls — just SHA-256 hashing of bytes already in
 * storage — so it's safe to run unconditionally on every build, no
 * --skip flag needed for the automatic path.
 *
 * Usage:
 *   bun run scripts/backfill-provenance.ts                # dry run, all published articles
 *   bun run scripts/backfill-provenance.ts --confirm       # seal everything missing
 *   bun run scripts/backfill-provenance.ts --confirm --force       # reseal even if already sealed
 *   bun run scripts/backfill-provenance.ts --confirm --limit 10
 *   bun run scripts/backfill-provenance.ts --confirm --article-id <id>
 */
import { db } from "../src/lib/db";
import { getObject } from "../src/lib/storage";
import { computeArticleContentHash, sha256 } from "../src/lib/article-provenance-server";

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

  const where: any = articleId ? { id: articleId } : { status: "PUBLISHED" };
  const candidates = await db.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  const targets = candidates.filter((a) => force || !a.contentHash);

  console.log(`Found ${candidates.length} published article(s)${articleId ? " (single-article mode)" : ""}.`);
  console.log(`${targets.length} need a provenance seal:`);
  for (const a of targets) {
    console.log(`  - [${a.id}] "${a.title}"`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    console.log(
      `\nDry run only — no changes made. Hashes real PDF/EPUB bytes already in storage, no billed API calls.` +
        `\nRe-run with --confirm to seal ${targets.length} article(s).`
    );
    return;
  }

  console.log(`\n--confirm passed. Sealing ${targets.length} article(s)...\n`);

  const failures: { id: string; title: string; error: unknown }[] = [];
  let sealed = 0;

  for (const article of targets) {
    try {
      const [pdfBytes, epubBytes] = await Promise.all([
        article.galleyPdfKey ? getObject(article.galleyPdfKey) : Promise.resolve(null),
        article.galleyEpubKey ? getObject(article.galleyEpubKey) : Promise.resolve(null),
      ]);
      const galleyPdfHash = pdfBytes ? sha256(pdfBytes) : null;
      const galleyEpubHash = epubBytes ? sha256(epubBytes) : null;
      const contentHash = computeArticleContentHash({
        id: article.id,
        title: article.title,
        authors: article.authors,
        abstract: article.abstract,
        doi: article.doi,
        publishedAtIso: article.publishedAt ? article.publishedAt.toISOString() : null,
        contentType: article.contentType,
        discipline: article.discipline,
        insightCategory: article.insightCategory,
        keyTakeaways: article.keyTakeaways,
        galleyPdfHash,
        galleyEpubHash,
      });

      await db.article.update({
        where: { id: article.id },
        data: { contentHash, galleyPdfHash, galleyEpubHash },
      });
      await db.auditLog.create({
        data: {
          action: "PROVENANCE_SEALED",
          entityType: "ARTICLE",
          entityId: article.id,
          articleId: article.id,
          metadata: JSON.stringify({ source: "backfill-provenance-script", force, contentHash }),
        },
      });

      sealed++;
      console.log(
        `  [${article.id}] sealed (contentHash=${contentHash.slice(0, 12)}…, pdf=${galleyPdfHash ? "yes" : "no"}, epub=${galleyEpubHash ? "yes" : "no"})`
      );
    } catch (error) {
      console.error(`  FAILED [${article.id}] "${article.title}":`, error);
      failures.push({ id: article.id, title: article.title, error });
    }
  }

  console.log(
    `\nDone. Sealed: ${sealed}. ${targets.length - failures.length}/${targets.length} article(s) completed without error.`
  );
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
