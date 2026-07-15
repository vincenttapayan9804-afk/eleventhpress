/**
 * Bulk backfill for PUBLISHED articles that predate the EPUB galley
 * (Phase A), AI glossary (Phase D), or auto-generated lay summary
 * features, so operators don't have to manually re-trigger each
 * article's production pipeline one at a time.
 *
 * Reuses the exact same manuscript-resolution + galley-generation logic as
 * the live publish path (src/lib/galley-regenerate.ts,
 * src/app/api/articles/workflow/route.ts) rather than duplicating it.
 *
 * COST NOTE: glossary and summary backfill each make a real, billed
 * Anthropic API call per article (src/lib/glossary.ts,
 * src/lib/manuscript-checks.ts). Galley backfill does real PDF/HTML/
 * EPUB/JATS rendering work. None of this is free to run at scale — review
 * the dry-run count before passing --confirm.
 *
 * Usage:
 *   bun run scripts/backfill-galleys.ts                       # dry run, all published articles
 *   bun run scripts/backfill-galleys.ts --confirm              # backfill missing galleys + glossary + summary
 *   bun run scripts/backfill-galleys.ts --confirm --galleys-only
 *   bun run scripts/backfill-galleys.ts --confirm --glossary-only
 *   bun run scripts/backfill-galleys.ts --confirm --summary-only
 *   bun run scripts/backfill-galleys.ts --confirm --force      # regenerate even if already present
 *   bun run scripts/backfill-galleys.ts --confirm --limit 10
 *   bun run scripts/backfill-galleys.ts --confirm --article-id <id>
 */
import { db } from "../src/lib/db";
import { generateGalleysForArticle } from "../src/lib/galley-regenerate";
import { generateGlossary } from "../src/lib/glossary";
import { suggestKeywordsAndSummary } from "../src/lib/manuscript-checks";

function flagValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return null;
  return args[idx + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");
  const onlyFlags = {
    galleys: args.includes("--galleys-only"),
    glossary: args.includes("--glossary-only"),
    summary: args.includes("--summary-only"),
  };
  const articleId = flagValue(args, "--article-id");
  const limitArg = flagValue(args, "--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const onlyCount = Object.values(onlyFlags).filter(Boolean).length;
  if (onlyCount > 1) {
    console.error("--galleys-only, --glossary-only, and --summary-only are mutually exclusive.");
    process.exit(1);
  }
  const doGalleys = onlyCount === 0 || onlyFlags.galleys;
  const doGlossary = onlyCount === 0 || onlyFlags.glossary;
  const doSummary = onlyCount === 0 || onlyFlags.summary;

  const where: any = articleId ? { id: articleId } : { status: "PUBLISHED" };
  const candidates = await db.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  const needsGalleys = (a: (typeof candidates)[number]) => force || !a.galleyEpubKey;
  const needsGlossary = (a: (typeof candidates)[number]) => force || !a.glossary;
  const needsSummary = (a: (typeof candidates)[number]) => force || !a.laySummary;

  const targets = candidates.filter(
    (a) =>
      (doGalleys && needsGalleys(a)) ||
      (doGlossary && needsGlossary(a)) ||
      (doSummary && needsSummary(a))
  );

  console.log(`Found ${candidates.length} published article(s)${articleId ? " (single-article mode)" : ""}.`);
  console.log(`${targets.length} need backfill:`);
  for (const a of targets) {
    const work: string[] = [];
    if (doGalleys && needsGalleys(a)) work.push("galleys+epub");
    if (doGlossary && needsGlossary(a)) work.push("glossary");
    if (doSummary && needsSummary(a)) work.push("lay summary");
    console.log(`  - [${a.id}] "${a.title}" (${work.join(", ")})`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    const llmCalls = [doGlossary && "glossary", doSummary && "lay summary"].filter(Boolean).join(" + ");
    console.log(
      `\nDry run only — no changes made. This will make ${llmCalls ? `real, billed Anthropic API calls (${llmCalls})` : "no LLM calls"}` +
        `${doGalleys ? " and real PDF/HTML/EPUB/JATS rendering work (galleys)" : ""}.` +
        `\nRe-run with --confirm to backfill ${targets.length} article(s).`
    );
    return;
  }

  console.log(`\n--confirm passed. Backfilling ${targets.length} article(s)...\n`);

  const failures: { id: string; title: string; error: unknown }[] = [];
  let galleysDone = 0;
  let glossaryDone = 0;
  let summaryDone = 0;

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

      if (doSummary && needsSummary(article)) {
        const summaryResult = await suggestKeywordsAndSummary({
          title: article.title,
          abstract: article.abstract,
          keywords: article.keywords,
        });
        await db.article.update({
          where: { id: article.id },
          data: {
            laySummary: summaryResult.laySummary,
            aiKeywordSuggestions: JSON.stringify(summaryResult.suggestedKeywords),
          },
        });
        summaryDone++;
        console.log(
          `  [${article.id}] lay summary ${summaryResult.mode === "llm" ? "generated" : "generated (heuristic fallback — no LLM configured)"}`
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
    `\nDone. Galleys backfilled: ${galleysDone}. Glossaries backfilled: ${glossaryDone}. Lay summaries backfilled: ${summaryDone}. ` +
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
