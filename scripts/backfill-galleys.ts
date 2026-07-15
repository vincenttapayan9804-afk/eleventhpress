/**
 * Bulk backfill for PUBLISHED articles that predate the EPUB galley
 * (Phase A) and/or AI glossary (Phase D) features, so operators don't have
 * to manually re-trigger each article's production pipeline one at a time.
 *
 * Reuses the exact same manuscript-resolution + galley-generation logic as
 * the live publish path (src/lib/galley-regenerate.ts,
 * src/app/api/articles/workflow/route.ts) rather than duplicating it.
 *
 * COST NOTE: glossary backfill makes a real, billed Anthropic API call
 * per article (src/lib/glossary.ts). Galley backfill does real PDF/HTML/
 * EPUB/JATS rendering work. Neither is free to run at scale — review the
 * dry-run count before passing --confirm.
 *
 * Usage:
 *   bun run scripts/backfill-galleys.ts                       # dry run, all published articles
 *   bun run scripts/backfill-galleys.ts --confirm              # backfill missing galleys + glossary
 *   bun run scripts/backfill-galleys.ts --confirm --galleys-only
 *   bun run scripts/backfill-galleys.ts --confirm --glossary-only
 *   bun run scripts/backfill-galleys.ts --confirm --force      # regenerate even if already present
 *   bun run scripts/backfill-galleys.ts --confirm --limit 10
 *   bun run scripts/backfill-galleys.ts --confirm --article-id <id>
 */
import { db } from "../src/lib/db";
import { generateGalleysForArticle } from "../src/lib/galley-regenerate";
import { generateGlossary } from "../src/lib/glossary";

function flagValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return null;
  return args[idx + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");
  const galleysOnly = args.includes("--galleys-only");
  const glossaryOnly = args.includes("--glossary-only");
  const articleId = flagValue(args, "--article-id");
  const limitArg = flagValue(args, "--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  if (galleysOnly && glossaryOnly) {
    console.error("--galleys-only and --glossary-only are mutually exclusive.");
    process.exit(1);
  }
  const doGalleys = !glossaryOnly;
  const doGlossary = !galleysOnly;

  const where: any = articleId ? { id: articleId } : { status: "PUBLISHED" };
  const candidates = await db.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  const needsGalleys = (a: (typeof candidates)[number]) => force || !a.galleyEpubKey;
  const needsGlossary = (a: (typeof candidates)[number]) => force || !a.glossary;

  const targets = candidates.filter(
    (a) => (doGalleys && needsGalleys(a)) || (doGlossary && needsGlossary(a))
  );

  console.log(`Found ${candidates.length} published article(s)${articleId ? " (single-article mode)" : ""}.`);
  console.log(`${targets.length} need backfill:`);
  for (const a of targets) {
    const work: string[] = [];
    if (doGalleys && needsGalleys(a)) work.push("galleys+epub");
    if (doGlossary && needsGlossary(a)) work.push("glossary");
    console.log(`  - [${a.id}] "${a.title}" (${work.join(", ")})`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    console.log(
      `\nDry run only — no changes made. This will make ${doGlossary ? "real, billed Anthropic API calls (glossary)" : "no LLM calls"}` +
        `${doGalleys ? " and real PDF/HTML/EPUB/JATS rendering work (galleys)" : ""}.` +
        `\nRe-run with --confirm to backfill ${targets.length} article(s).`
    );
    return;
  }

  console.log(`\n--confirm passed. Backfilling ${targets.length} article(s)...\n`);

  const failures: { id: string; title: string; error: unknown }[] = [];
  let galleysDone = 0;
  let glossaryDone = 0;

  for (const article of targets) {
    try {
      if (doGalleys && needsGalleys(article)) {
        const result = await generateGalleysForArticle(article.id);
        if (result) {
          await db.article.update({
            where: { id: article.id },
            data: {
              galleyHtmlKey: result.htmlKey,
              galleyPdfKey: result.pdfKey,
              galleyJatsKey: result.jatsKey,
              galleyEpubKey: result.epubKey,
            },
          });
          galleysDone++;
          console.log(`  [${article.id}] galleys regenerated (epub=${result.epubKey || "—"})`);
        } else {
          console.warn(`  [${article.id}] galley regeneration returned no result (article vanished mid-run?)`);
        }
      }

      if (doGlossary && needsGlossary(article)) {
        const glossaryResult = await generateGlossary({
          title: article.title,
          abstract: article.abstract,
          keywords: article.keywords,
          discipline: article.discipline,
        });
        await db.article.update({
          where: { id: article.id },
          data: {
            glossary: JSON.stringify(glossaryResult.terms),
            glossaryMeta: JSON.stringify({
              mode: glossaryResult.mode,
              model: glossaryResult.model,
              generatedAt: glossaryResult.generatedAt,
            }),
          },
        });
        glossaryDone++;
        console.log(
          `  [${article.id}] glossary ${glossaryResult.mode === "llm" ? `generated (${glossaryResult.terms.length} terms)` : "unavailable — no LLM configured"}`
        );
      }

      await db.auditLog.create({
        data: {
          action: "GALLEY_GENERATED",
          entityType: "ARTICLE",
          entityId: article.id,
          articleId: article.id,
          metadata: JSON.stringify({ source: "backfill-galleys-script", force }),
        },
      });
    } catch (error) {
      console.error(`  FAILED [${article.id}] "${article.title}":`, error);
      failures.push({ id: article.id, title: article.title, error });
    }
  }

  console.log(
    `\nDone. Galleys backfilled: ${galleysDone}. Glossaries backfilled: ${glossaryDone}. ` +
      `${targets.length - failures.length}/${targets.length} article(s) completed without error.`
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
