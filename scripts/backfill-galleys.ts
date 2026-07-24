/**
 * Backfill for PUBLISHED articles missing the EPUB galley or rendered under
 * a stale visual template (Phase A), AI glossary (Phase D), auto-generated
 * lay summary, RAG chunk embeddings (src/lib/chunk-embeddings.ts), a
 * full-text translation into every supported locale
 * (src/lib/galley-translation.ts), cached "why this is related" explanations
 * for their top similar articles (src/lib/related-explanation.ts),
 * table-accessibility caption suggestions (src/lib/table-accessibility.ts),
 * or a real semantic (rather than hashed-n-gram) whole-article embedding
 * (src/lib/embeddings.ts) — all eight are now generated automatically at
 * publish time (src/app/api/articles/workflow/route.ts), but articles
 * published before each feature shipped (or before a later galley
 * re-brand — see GALLEY_TEMPLATE_VERSION in src/lib/galley.ts) predate it
 * and need a one-time catch-up.
 *
 * Runs automatically, idempotently, on every production build —
 * package.json's "build" script calls this with --confirm right after
 * scripts/seed.ts (the same precedent: a script that runs on every Vercel
 * deploy with real DB/API credentials and no-ops once nothing is missing
 * or stale). Galley regeneration is real PDF/HTML/EPUB/JATS rendering work,
 * but each article is wrapped in its own try/catch and failures are
 * logged rather than thrown, so one slow or failing render can't fail the
 * whole production build — it just leaves that article's
 * galleyTemplateVersion stale for the next deploy to retry.
 *
 * Reuses the exact same manuscript-resolution + galley-generation logic as
 * the live publish path (src/lib/galley-regenerate.ts) rather than
 * duplicating it.
 *
 * COST NOTE: glossary, summary, translation, related-article-explanation,
 * and table-accessibility backfill each make real chatJSON calls
 * (src/lib/glossary.ts, src/lib/manuscript-checks.ts,
 * src/lib/galley-translation.ts, src/lib/related-explanation.ts,
 * src/lib/table-accessibility.ts) — cost-first as of Phase A/C/D/H, so the
 * free OpenRouter tier is tried before any billed Anthropic call. Galley
 * backfill does real PDF/HTML/EPUB/JATS rendering work. Embedding backfill
 * makes no LLM call at all — local model inference only, $0 either way.
 * All are idempotent — once an article has the field (or, for translation/
 * explanations/table-accessibility, has every locale/top-match/table
 * covered, or for embeddings, is already on the real local model), later
 * runs skip it — so steady-state cost after the first backfill is zero.
 *
 * Usage:
 *   bun run scripts/backfill-galleys.ts                        # dry run, all published articles
 *   bun run scripts/backfill-galleys.ts --confirm               # backfill everything missing
 *   bun run scripts/backfill-galleys.ts --confirm --skip-galleys
 *   bun run scripts/backfill-galleys.ts --confirm --skip-glossary
 *   bun run scripts/backfill-galleys.ts --confirm --skip-summary
 *   bun run scripts/backfill-galleys.ts --confirm --skip-chunks
 *   bun run scripts/backfill-galleys.ts --confirm --skip-translation
 *   bun run scripts/backfill-galleys.ts --confirm --skip-explanations
 *   bun run scripts/backfill-galleys.ts --confirm --skip-table-a11y
 *   bun run scripts/backfill-galleys.ts --confirm --skip-embeddings
 *   bun run scripts/backfill-galleys.ts --confirm --force       # regenerate even if already present
 *   bun run scripts/backfill-galleys.ts --confirm --limit 10
 *   bun run scripts/backfill-galleys.ts --confirm --article-id <id>
 */
import { db } from "../src/lib/db";
import { generateGalleysForArticle } from "../src/lib/galley-regenerate";
import { GALLEY_TEMPLATE_VERSION } from "../src/lib/galley";
import { generateGlossary } from "../src/lib/glossary";
import { suggestKeywordsAndSummary } from "../src/lib/manuscript-checks";
import { indexArticleChunks } from "../src/lib/chunk-embeddings";
import { translateGalleyText, TRANSLATABLE_LOCALES, type TranslatableLocale } from "../src/lib/galley-translation";
import { getSimilarArticles } from "../src/lib/manuscript-checks";
import { getOrGenerateRelationExplanation } from "../src/lib/related-explanation";
import { runTableAccessibilityJob } from "../src/lib/table-accessibility";
import { indexArticle, REAL_EMBEDDING_MODEL_ID } from "../src/lib/embeddings";

const RELATED_ARTICLES_LIMIT = 3;

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
  const doExplanations = !args.includes("--skip-explanations");
  const doTableA11y = !args.includes("--skip-table-a11y");
  const doEmbeddings = !args.includes("--skip-embeddings");
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

  // Bulk pre-check for related-article explanation coverage. A count below
  // the limit is a reasonable proxy for "needs work" without running the
  // (cheap, non-LLM) embedding lookup for every candidate up front — the
  // per-article loop below re-runs getSimilarArticles for anything flagged
  // here and getOrGenerateRelationExplanation no-ops on an actual cache hit,
  // so this proxy never causes a real LLM call to be skipped or duplicated.
  const explanationCountByArticle = new Map<string, number>();
  for (const row of await db.articleSimilarityExplanation.groupBy({ by: ["articleId"], _count: { _all: true } })) {
    explanationCountByArticle.set(row.articleId, row._count._all);
  }

  // Bulk pre-check for table-accessibility coverage — an article "has been
  // checked" once it has a COMPLETED TableAccessibilityJob, whether or not
  // that run actually found any tables (an article with no tables is
  // legitimately done, not pending).
  const tableA11yCheckedArticleIds = new Set(
    (await db.tableAccessibilityJob.findMany({ where: { status: "COMPLETED" }, select: { articleId: true } })).map(
      (r) => r.articleId
    )
  );

  // Bulk pre-check for embedding freshness — an article "needs" a re-embed
  // if it has no ArticleEmbedding row yet, or its row's `model` isn't the
  // real local sentence-embedding model (src/lib/embeddings.ts), i.e. it's
  // still on the old hashed-n-gram scheme from before that model was wired
  // in. Cheap: no LLM call, just local model inference.
  const embeddingModelByArticle = new Map<string, string>();
  for (const row of await db.articleEmbedding.findMany({ select: { articleId: true, model: true } })) {
    embeddingModelByArticle.set(row.articleId, row.model);
  }

  // Fires for articles missing the EPUB galley entirely, or whose galleys
  // were rendered under an older visual template (src/lib/galley.ts
  // GALLEY_TEMPLATE_VERSION) — e.g. this is what makes a rebrand of the
  // PDF/HTML galleys reach already-published articles automatically on
  // the next production build, without a manual --force run.
  const needsGalleys = (a: (typeof candidates)[number]) =>
    force || !a.galleyEpubKey || a.galleyTemplateVersion < GALLEY_TEMPLATE_VERSION;
  const needsGlossary = (a: (typeof candidates)[number]) => force || !a.glossary;
  const needsSummary = (a: (typeof candidates)[number]) => force || !a.laySummary;
  const needsChunks = (a: (typeof candidates)[number]) => force || !chunkedArticleIds.has(a.id);
  const needsTranslation = (a: (typeof candidates)[number]) => missingLocales(a).length > 0;
  const needsExplanations = (a: (typeof candidates)[number]) =>
    force || (explanationCountByArticle.get(a.id) ?? 0) < RELATED_ARTICLES_LIMIT;
  const needsTableA11y = (a: (typeof candidates)[number]) => force || !tableA11yCheckedArticleIds.has(a.id);
  const needsEmbedding = (a: (typeof candidates)[number]) =>
    force || embeddingModelByArticle.get(a.id) !== REAL_EMBEDDING_MODEL_ID;

  const targets = candidates.filter(
    (a) =>
      (doGalleys && needsGalleys(a)) ||
      (doGlossary && needsGlossary(a)) ||
      (doSummary && needsSummary(a)) ||
      (doChunks && needsChunks(a)) ||
      (doTranslation && needsTranslation(a)) ||
      (doExplanations && needsExplanations(a)) ||
      (doTableA11y && needsTableA11y(a)) ||
      (doEmbeddings && needsEmbedding(a))
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
    if (doExplanations && needsExplanations(a)) work.push("related-article explanations");
    if (doTableA11y && needsTableA11y(a)) work.push("table accessibility");
    if (doEmbeddings && needsEmbedding(a)) work.push("semantic embedding");
    console.log(`  - [${a.id}] "${a.title}" (${work.join(", ")})`);
  }

  if (targets.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!confirm) {
    const llmCalls = [doGlossary && "glossary", doSummary && "lay summary", doTranslation && "translation", doExplanations && "related-article explanations", doTableA11y && "table accessibility"].filter(Boolean).join(" + ");
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
  let explanationsDone = 0;
  let tableA11yDone = 0;
  let embeddingsDone = 0;

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
              galleyTemplateVersion: GALLEY_TEMPLATE_VERSION,
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

      if (doExplanations && needsExplanations(article)) {
        const similar = await getSimilarArticles(article.id, RELATED_ARTICLES_LIMIT);
        let generated = 0;
        for (const s of similar) {
          const explanationResult = await getOrGenerateRelationExplanation(article.id, s.articleId);
          if (explanationResult.mode === "llm") generated++;
        }
        explanationsDone += generated;
        console.log(
          `  [${article.id}] related-article explanations: ${generated}/${similar.length} generated${similar.length === 0 ? " (no similar articles in corpus yet)" : ""}`
        );
      }

      if (doTableA11y && needsTableA11y(article)) {
        const job = await db.tableAccessibilityJob.create({ data: { articleId: article.id, status: "QUEUED" } });
        await runTableAccessibilityJob(job.id, null, { status: "QUEUED" });
        const finished = await db.tableAccessibilityJob.findUnique({ where: { id: job.id } });
        if (finished?.status === "COMPLETED") {
          tableA11yDone++;
          console.log(`  [${article.id}] table accessibility: checked (${finished.tablesFound} table(s) found)`);
        } else {
          console.warn(`  [${article.id}] table accessibility job did not complete: ${finished?.errorMessage ?? "unknown error"}`);
        }
      }

      if (doEmbeddings && needsEmbedding(article)) {
        await indexArticle(article.id);
        const row = await db.articleEmbedding.findUnique({ where: { articleId: article.id }, select: { model: true } });
        if (row?.model === REAL_EMBEDDING_MODEL_ID) embeddingsDone++;
        console.log(
          `  [${article.id}] semantic embedding ${row?.model === REAL_EMBEDDING_MODEL_ID ? `re-indexed (${row.model})` : `re-indexed (hash fallback — local model unavailable in this instance)`}`
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
    `\nDone. Galleys backfilled: ${galleysDone}. Glossaries backfilled: ${glossaryDone}. Lay summaries backfilled: ${summaryDone}. RAG chunks backfilled: ${chunksDone}. Translations backfilled: ${translationsDone}. Related-article explanations backfilled: ${explanationsDone}. Table-accessibility checks backfilled: ${tableA11yDone}. Semantic embeddings upgraded: ${embeddingsDone}. ` +
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
