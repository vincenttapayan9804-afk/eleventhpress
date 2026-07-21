/**
 * Backfill for PUBLISHED articles missing the EPUB galley (Phase A), AI
 * glossary (Phase D), auto-generated lay summary, RAG chunk embeddings
 * (src/lib/chunk-embeddings.ts), or a full-text translation into every
 * supported locale (src/lib/galley-translation.ts) — all five are now
 * generated automatically at publish time
 * (src/app/api/articles/workflow/route.ts), but articles published before
 * each feature shipped predate it and need a one-time catch-up.
 *
 * Runs in two contexts:
 *  1. Automatically, idempotently, on every production build — package.json's
 *     "build" script calls this with --skip-galleys right after
 *     scripts/seed.ts (the same precedent: a script that runs on every
 *     Vercel deploy with real DB/API credentials and no-ops once nothing
 *     is missing). This is what makes glossary + lay summary generation
 *     genuinely automatic for every article, not just ones published after
 *     this code shipped, without requiring a human to run anything.
 *  2. Manually, by an operator with production credentials, for the
 *     heavier galley/EPUB regeneration this script also supports (real
 *     PDF/HTML/EPUB/JATS rendering — deliberately left out of the
 *     automatic build-time run so a slow or failing production service
 *     doesn't add build-time risk for something that isn't in the hot
 *     path of what readers see first).
 *
 * Reuses the exact same manuscript-resolution + galley-generation logic as
 * the live publish path (src/lib/galley-regenerate.ts) rather than
 * duplicating it.
 *
 * COST NOTE: glossary, summary, and translation backfill each make real
 * chatJSON calls (src/lib/glossary.ts, src/lib/manuscript-checks.ts,
 * src/lib/galley-translation.ts) — cost-first as of Phase A/C, so the free
 * OpenRouter tier is tried before any billed Anthropic call. Galley
 * backfill does real PDF/HTML/EPUB/JATS rendering work. All four are
 * idempotent — once an article has the field (or, for translation, has
 * every locale), later runs skip it — so steady-state cost after the
 * first backfill is zero.
 *
 * Usage:
 *   bun run scripts/backfill-galleys.ts                        # dry run, all published articles
 *   bun run scripts/backfill-galleys.ts --confirm               # backfill everything missing
 *   bun run scripts/backfill-galleys.ts --confirm --skip-galleys
 *   bun run scripts/backfill-galleys.ts --confirm --skip-glossary
 *   bun run scripts/backfill-galleys.ts --confirm --skip-summary
 *   bun run scripts/backfill-galleys.ts --confirm --skip-chunks
 *   bun run scripts/backfill-galleys.ts --confirm --skip-translation
 *   bun run scripts/backfill-galleys.ts --confirm --force       # regenerate even if already present
 *   bun run scripts/backfill-galleys.ts --confirm --limit 10
 *   bun run scripts/backfill-galleys.ts --confirm --article-id <id>
 */
import { db } from "../src/lib/db";
import { generateGalleysForArticle } from "../src/lib/galley-regenerate";
import { generateGlossary } from "../src/lib/glossary";
import { suggestKeywordsAndSummary } from "../src/lib/manuscript-checks";
import { indexArticleChunks } from "../src/lib/chunk-embeddings";
import { translateGalleyText, TRANSLATABLE_LOCALES, type TranslatableLocale } from "../src/lib/galley-translation";

function flagValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return null;
  return args[idx + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");
  const doGalleys = !args.includes("--skip-galleys");
  const doGlossary = !args.includes("--skip-glossary");
  const doSummary = !args.includes("--skip-summary");
  const doChunks = !args.includes("--skip-chunks");
  const doTranslation = !args.includes("--skip-translation");
  const articleId = flagValue(args, "--article-id");
  const limitArg = flagValue(args, "--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const where: any = articleId ? { id: articleId } : { status: "PUBLISHED" };
  const candidates = await db.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  // Bulk pre-check for chunk coverage — ArticleChunk existence isn't a
  // field on Article itself, so this needs its own query, done once up
  // front rather than per-article inside the filter below.
  const chunkedArticleIds = new Set(
    (await db.articleChunk.groupBy({ by: ["articleId"] })).map((r) => r.articleId)
  );

  // Bulk pre-check for translation coverage — one row per article+locale,
  // so "fully translated" means all of TRANSLATABLE_LOCALES are present.
  const translatedLocalesByArticle = new Map<string, Set<string>>();
  for (const row of await db.articleGalleyTranslation.findMany({ select: { articleId: true, locale: true } })) {
    if (!translatedLocalesByArticle.has(row.articleId)) translatedLocalesByArticle.set(row.articleId, new Set());
    translatedLocalesByArticle.get(row.articleId)!.add(row.locale);
  }
  const missingLocales = (a: (typeof candidates)[number]): TranslatableLocale[] => {
    const have = translatedLocalesByArticle.get(a.id);
    return TRANSLATABLE_LOCALES.filter((locale) => force || !have?.has(locale));
  };

  const needsGalleys = (a: (typeof candidates)[number]) => force || !a.galleyEpubKey;
  const needsGlossary = (a: (typeof candidates)[number]) => force || !a.glossary;
  const needsSummary = (a: (typeof candidates)[number]) => force || !a.laySummary;
  const needsChunks = (a: (typeof candidates)[number]) => force || !chunkedArticleIds.has(a.id);
  const needsTranslation = (a: (typeof candidates)[number]) => missingLocales(a).length > 0;

  const targets = candidates.filter(
    (a) =>
      (doGalleys && needsGalleys(a)) ||
      (doGlossary && needsGlossary(a)) ||
      (doSummary && needsSummary(a)) ||
      (doChunks && needsChunks(a)) ||
      (doTranslation && needsTranslation(a))
  );

  console.log(`Found ${candidates.length} published article(s)${articleId ? " (single-article mode)" : ""}.`);
  console.log(`${targets.length} need backfill:`);
  for (const a of targets) {
    const work: string[] = [];
    if (doGalleys && needsGalleys(a)) work.push("galleys+epub");
    if (doGlossary && needsGlossary(a)) work.push("glossary");
    if (doSummary && needsSummary(a)) work.push("lay summary");
    if (doChunks && needsChunks(a)) work.push("RAG chunks");
    if (doTranslation && needsTranslation(a)) work.push(`translation (${missingLocales(a).join(", ")})`);
    console.log(`  - [${a.id}] "${a.title}" (${work.join(", ")})`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    const llmCalls = [doGlossary && "glossary", doSummary && "lay summary", doTranslation && "translation"].filter(Boolean).join(" + ");
    console.log(
      `\nDry run only — no changes made. This will make ${llmCalls ? `real AI calls (cost-first: free tier tried before any billed Anthropic call) (${llmCalls})` : "no LLM calls"}` +
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
  let chunksDone = 0;
  let translationsDone = 0;

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

      if (doChunks && needsChunks(article)) {
        // Reads article.galleyHtmlKey fresh from the DB internally, so it
        // picks up any galley regeneration that just happened above in
        // this same iteration.
        const chunkResult = await indexArticleChunks(article.id);
        chunksDone++;
        console.log(
          `  [${article.id}] RAG chunks ${chunkResult.chunkCount > 0 ? `indexed (${chunkResult.chunkCount} passages, ${chunkResult.mode})` : "skipped — no galley/abstract text to chunk"}`
        );
      }

      if (doTranslation && needsTranslation(article)) {
        // One translateGalleyText call per missing locale — same
        // per-article read of galleyHtmlKey it always does, so this also
        // picks up any galley regeneration from earlier in this iteration.
        for (const locale of missingLocales(article)) {
          const translationResult = await translateGalleyText(article.id, locale);
          if (translationResult.mode !== "heuristic") translationsDone++;
          console.log(
            `  [${article.id}] translation (${locale}) ${translationResult.mode === "llm" ? "generated" : translationResult.mode === "partial" ? `generated (partial, ${translationResult.translatedChars}/${translationResult.totalChars} chars)` : "unavailable — no LLM configured"}`
          );
        }
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
    `\nDone. Galleys backfilled: ${galleysDone}. Glossaries backfilled: ${glossaryDone}. Lay summaries backfilled: ${summaryDone}. RAG chunks backfilled: ${chunksDone}. Translations backfilled: ${translationsDone}. ` +
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
