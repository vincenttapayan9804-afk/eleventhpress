import { NextRequest, NextResponse } from "next/server";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";
import { retrieveChunksAcrossCorpus } from "@/lib/chunk-embeddings";
import { db } from "@/lib/db";
import {
  ARTICLE_RECORD_SELECT,
  GROUNDING_RULES,
  formatArticleRecord,
  formatHistory,
  normalizeUsedPassages,
  type ArticleRecord,
  type ChatTurn,
} from "@/lib/rag-prompt";

/**
 * POST /api/corpus-chat — "Ask the Corpus" journal-wide RAG chat.
 *
 * Same honest-grounding contract as the per-article chat
 * (src/app/api/articles/[id]/chat/route.ts) — every answer is drawn only
 * from passages retrieved across every PUBLISHED article's chunked galley
 * text (src/lib/chunk-embeddings.ts's retrieveChunksAcrossCorpus()), never
 * general knowledge, and the response always reports which passages (and
 * which article each came from) it says it used, so the UI can show real,
 * clickable citations rather than an unverifiable claim.
 *
 * Public, no login required — same reasoning as the per-article route
 * (the content is already open access) — rate-limited per IP separately
 * from the per-article route since a corpus-wide query does more work
 * (a wider retrieval scan, plus a longer system prompt).
 */
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 800;

/** What readers see whenever no answer can be produced for an operational
 * reason (no provider configured, a provider outage, a rejected or expired
 * API key, a retrieval error). The real cause is logged server-side only:
 * an upstream error body is an operator detail, not something a reader
 * should see. */
const UNAVAILABLE_MESSAGE =
  "Ask the Corpus is temporarily unavailable. Please try again in a few minutes, or browse and search the published articles directly.";
const MAX_HISTORY_TURNS = 6;
/** Passages retrieved per question. */
const PASSAGE_LIMIT = 10;
/** Ask the model again once if the first reply fails (the free router can
 * pick a model that returns a malformed reply), as long as there's time
 * left within maxDuration. */
const RETRY_IF_FAILED_WITHIN_MS = 25_000;

/** Bibliographic records for every article a passage came from, so the
 * model can answer "who wrote", "when was it published", "what is it
 * about" from the record itself rather than guessing. Best effort: a
 * lookup failure just means the answer relies on the passages alone. */
async function loadArticleRecords(ids: string[]): Promise<ArticleRecord[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await db.article.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: ARTICLE_RECORD_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is ArticleRecord => !!r);
  } catch (e) {
    console.error("[corpus-chat] article records lookup failed:", e);
    return [];
  }
}

export async function POST(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`corpus-chat:${ip}`, 8, 300);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  let body: { question?: string; history?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` }, { status: 400 });
  }

  if (!anyLLMAvailable()) {
    console.warn("[corpus-chat] no LLM provider configured (set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or LLM_BASE_URL/LLM_API_KEY)");
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const historyBlock = formatHistory(history);
  // A follow-up such as "what were its limitations?" doesn't name the
  // paper, so retrieval also sees the reader's previous question.
  const previousQuestion = [...history].reverse().find((t) => t?.role === "user")?.content;
  const retrievalQuery =
    typeof previousQuestion === "string" && previousQuestion.trim()
      ? `${question}\n${previousQuestion.slice(0, MAX_QUESTION_LENGTH)}`
      : question;

  let chunks: Awaited<ReturnType<typeof retrieveChunksAcrossCorpus>>;
  try {
    chunks = await retrieveChunksAcrossCorpus(retrievalQuery, PASSAGE_LIMIT);
  } catch (e) {
    console.error("[corpus-chat] retrieval failed:", e);
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
  if (chunks.length === 0) {
    return NextResponse.json({
      mode: "not-indexed",
      message: "No published articles are indexed for chat yet.",
    });
  }

  // One label per source article (A1, A2, ...), shared by the details
  // block and the passages so the model can tie them together.
  const articleIds = [...new Set(chunks.map((c) => c.articleId))];
  const labelOf = new Map(articleIds.map((id, i) => [id, `A${i + 1}`]));
  const records = await loadArticleRecords(articleIds);
  const focusedTitles = [...new Set(chunks.filter((c) => c.focused).map((c) => c.articleTitle))];

  const recordsBlock = records.length
    ? `ARTICLE RECORDS (bibliographic details of each source article):\n\n${records
        .map((a) => formatArticleRecord(a, labelOf.get(a.id)))
        .join("\n\n")}`
    : "";
  const passageBlock = `PASSAGES (excerpts from the articles' full text):\n\n${chunks
    .map((c, i) => `[Passage ${i + 1} | ${labelOf.get(c.articleId)} "${c.articleTitle}"]\n${c.text}`)
    .join("\n\n")}`;
  const focusNote = focusedTitles.length
    ? `\n\nThe reader appears to be asking about: ${focusedTitles.map((t) => `"${t}"`).join(", ")}.`
    : "";

  const systemPrompt =
    "You are the research assistant for an academic journal. You answer readers' questions using ONLY the journal records provided in the message: ARTICLE RECORDS (title, authors, date, DOI, keywords, abstract) and PASSAGES (excerpts from the published full text). If the article the reader means is not among the records, say so.\n" +
    GROUNDING_RULES;

  const userPrompt = `${recordsBlock}\n\n${passageBlock}${historyBlock}${focusNote}\n\nReader's question: ${question}`;

  try {
    const ask = () =>
      chatJSON<{ answer: string; usedPassages?: number[]; grounded?: boolean }>(systemPrompt, userPrompt, {
        maxTokens: 1200,
        priority: "cost-first",
        temperature: 0.1,
      });
    const started = Date.now();
    let result: Awaited<ReturnType<typeof ask>>;
    try {
      result = await ask();
      if (typeof result.data?.answer !== "string" || !result.data.answer.trim()) {
        throw new Error("model reply had no answer text");
      }
    } catch (first) {
      if (Date.now() - started > RETRY_IF_FAILED_WITHIN_MS) throw first;
      console.warn("[corpus-chat] first attempt failed, retrying once:", first);
      result = await ask();
      if (typeof result.data?.answer !== "string" || !result.data.answer.trim()) {
        throw new Error("model reply had no answer text");
      }
    }

    const grounded = result.data.grounded !== false;
    const usedPassages = normalizeUsedPassages(result.data.usedPassages);
    let cited = usedPassages.map((n) => chunks[n - 1]).filter((c): c is (typeof chunks)[number] => !!c);
    // An answer drawn only from the article records (e.g. "who wrote X?")
    // still cites its source: the named article's opening passage.
    if (cited.length === 0 && grounded) {
      cited = chunks.filter((c) => c.focused).slice(0, 1);
    }
    console.info(`[corpus-chat] answered by ${result.provider}/${result.model}; ${chunks.length} passages, cited ${cited.length}, grounded=${grounded}`);
    const citedChunks = cited
      .map((c) => ({
        chunkIndex: c.chunkIndex,
        text: c.text,
        matchType: c.matchType,
        articleId: c.articleId,
        articleTitle: c.articleTitle,
      }));

    return NextResponse.json({
      mode: "answered",
      answer: result.data.answer,
      grounded,
      citedChunks,
      model: result.model,
    });
  } catch (e) {
    // e.g. a 401 "invalid x-api-key" from a provider, an exhausted credit
    // balance, a rate limit or a malformed reply. Logged in full here; the
    // reader gets the same friendly "unavailable" banner as every other
    // non-answer path, never the raw upstream error.
    console.error("[corpus-chat] chat failed:", e);
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
}
