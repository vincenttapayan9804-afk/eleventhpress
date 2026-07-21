/**
 * Full-text (not just abstract) article translation — extends the existing
 * abstract-only translateAbstract() (src/lib/manuscript-checks.ts) to the
 * complete galley body, into one of the site's 5-locale i18n's 4 non-
 * English locales (src/lib/manuscript-checks.ts's TRANSLATABLE_LOCALES).
 *
 * A full article can be far too long for one chatJSON() call, so this
 * batches the plain-text galley body into ~6000-character windows (a
 * courser grain than chunk-embeddings.ts's ~800-char RAG passages — fewer,
 * larger LLM calls, since a translation call doesn't need retrieval-sized
 * granularity) and translates each window in order via the same Anthropic
 * -> free-OSS-tier chain every other AI feature in this codebase uses.
 * Everything above MAX_TOTAL_CHARS is left untranslated rather than
 * silently dropped or run past a serverless function's time budget — the
 * result is honestly tagged mode: "partial" with translatedChars/
 * totalChars so the reader sees exactly how much of the article this
 * covers, never presented as if it were the whole thing.
 *
 * There is no offline machine-translation fallback here, same reasoning as
 * translateAbstract(): a translation heuristic would just be wrong, not
 * merely lower-quality. When no LLM tier is configured at all, this
 * returns the original English text unchanged, tagged mode: "heuristic".
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";
import { htmlToPlainText, chunkText } from "@/lib/chunk-embeddings";
import { TRANSLATABLE_LOCALES, type TranslatableLocale } from "@/lib/manuscript-checks";

export { TRANSLATABLE_LOCALES, type TranslatableLocale };

const BATCH_TARGET_CHARS = 6000;
const MAX_TOTAL_CHARS = 42000; // ~7 batches — bounded to fit comfortably inside one 60s serverless invocation

const LOCALE_NAMES: Record<TranslatableLocale, string> = {
  es: "Spanish",
  fr: "French",
  fil: "Filipino (Tagalog-based)",
  "zh-Hans": "Simplified Chinese",
};

export interface GalleyTranslationResult {
  translatedText: string;
  mode: "llm" | "partial" | "heuristic";
  model: string;
  translatedChars: number;
  totalChars: number;
}

/** Groups ~800-char RAG-sized chunks back up into ~BATCH_TARGET_CHARS
 * windows for fewer, larger translation calls. */
function batchPassages(passages: string[]): string[] {
  const batches: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const p of passages) {
    if (currentLen > 0 && currentLen + p.length > BATCH_TARGET_CHARS) {
      batches.push(current.join(" "));
      current = [];
      currentLen = 0;
    }
    current.push(p);
    currentLen += p.length;
  }
  if (current.length > 0) batches.push(current.join(" "));
  return batches;
}

const TRANSLATE_BATCH_SYSTEM_PROMPT = (targetLanguage: string) =>
  `You are a scholarly translator. Translate the given passage of an academic article's body text into ${targetLanguage}, preserving its academic register and technical terminology precisely — do not simplify, summarize, add commentary, or omit any sentence. Respond with a single JSON object (no markdown, no preamble): {"translatedText": "<the translation>"}`;

async function translateBatch(text: string, targetLocale: TranslatableLocale) {
  const { data, model: usedModel } = await chatJSON<{ translatedText: string }>(
    TRANSLATE_BATCH_SYSTEM_PROMPT(LOCALE_NAMES[targetLocale]),
    text,
    { maxTokens: 3000, priority: "cost-first" }
  );
  return { text: data.translatedText?.trim() || "", model: usedModel };
}

/**
 * Translates articleId's full galley body into targetLocale and persists
 * the result to ArticleGalleyTranslation (one row per article+locale,
 * overwritten on re-translation — same "safe to call again" contract as
 * indexArticleChunks()). Self-contained: fetches the galley text and
 * writes the result itself, so callers (the API route) stay thin.
 */
export async function translateGalleyText(
  articleId: string,
  targetLocale: TranslatableLocale
): Promise<GalleyTranslationResult> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { galleyHtmlKey: true, title: true, abstract: true },
  });
  if (!article) {
    throw new Error("Article not found");
  }

  let bodyText = "";
  if (article.galleyHtmlKey) {
    const bytes = await getObject(article.galleyHtmlKey);
    if (bytes) bodyText = htmlToPlainText(bytes.toString("utf-8"));
  }
  const fullText = [article.title, article.abstract, bodyText].filter(Boolean).join("\n\n");

  if (!anyLLMAvailable() || !fullText.trim()) {
    return { translatedText: fullText, mode: "heuristic", model: "heuristic-fallback", translatedChars: 0, totalChars: fullText.length };
  }

  const truncated = fullText.length > MAX_TOTAL_CHARS;
  const toTranslate = truncated ? fullText.slice(0, MAX_TOTAL_CHARS) : fullText;
  const batches = batchPassages(chunkText(toTranslate));

  const translatedParts: string[] = [];
  let model = "unknown";
  let anyFailed = false;
  let sourceCharsCovered = 0;

  for (const batch of batches) {
    try {
      const result = await translateBatch(batch, targetLocale);
      translatedParts.push(result.text);
      model = result.model;
      sourceCharsCovered += batch.length;
    } catch (e) {
      console.error(`[galley-translation] batch translation failed for article ${articleId}, locale ${targetLocale}:`, e);
      anyFailed = true;
      break;
    }
  }

  if (translatedParts.length === 0) {
    return { translatedText: fullText, mode: "heuristic", model: "heuristic-fallback", translatedChars: 0, totalChars: fullText.length };
  }

  const translatedText = translatedParts.join("\n\n");
  const mode: GalleyTranslationResult["mode"] = truncated || anyFailed ? "partial" : "llm";

  await db.articleGalleyTranslation.upsert({
    where: { articleId_locale: { articleId, locale: targetLocale } },
    create: { articleId, locale: targetLocale, translatedText, mode, model },
    update: { translatedText, mode, model, translatedAt: new Date() },
  });

  return { translatedText, mode, model, translatedChars: sourceCharsCovered, totalChars: fullText.length };
}

/** Reads back a previously-translated galley, if one exists. */
export async function getGalleyTranslation(articleId: string, locale: TranslatableLocale) {
  return db.articleGalleyTranslation.findUnique({
    where: { articleId_locale: { articleId, locale } },
  });
}
