import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";
import { retrieveChunks, indexArticleChunks } from "@/lib/chunk-embeddings";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import {
  ARTICLE_RECORD_SELECT,
  GROUNDING_RULES,
  formatArticleRecord,
  formatHistory,
  normalizeUsedPassages,
  type ChatTurn,
} from "@/lib/rag-prompt";

/**
 * POST /api/articles/[id]/chat — "Ask this paper" RAG chat.
 *
 * Public (no login required — the article itself is already open access),
 * but real, billed Anthropic API calls happen on every message, so this is
 * rate-limited per IP same as the auth routes (src/lib/ratelimit.ts).
 *
 * Only answers from passages actually retrieved from this specific
 * article's chunked galley text (src/lib/chunk-embeddings.ts) — the system
 * prompt explicitly forbids answering from general knowledge, and the
 * response always reports which passages it says it used so the UI can
 * show real citations rather than an unverifiable claim.
 *
 * Honest unavailable states, matching every other LLM-backed feature in
 * this codebase (glossary.ts, manuscript-checks.ts): no ANTHROPIC_API_KEY
 * configured, or the article genuinely has no chunkable text, both return
 * a 200 with an explicit `mode` rather than a fabricated answer.
 *
 * Every PUBLISHED article is chunk-indexed at publish time (fire-and-forget,
 * src/app/api/articles/workflow/route.ts) and, for anything published
 * before that shipped, on every production build (scripts/backfill-
 * galleys.ts, run from package.json's "build" script). Those two paths
 * cover the steady state, but neither is guaranteed to have run yet for a
 * given article at the moment someone asks it a question — a transient
 * failure in the fire-and-forget publish-time call, or simply no
 * production build having happened since publish. Rather than leave a
 * reader stuck on "try again shortly" until the next deploy, this route
 * self-heals: on a cache miss it indexes on demand, right here, and
 * retries once before giving up.
 */

// On-demand indexing embeds every ~800-char passage of the article's full
// galley text sequentially (src/lib/chunk-embeddings.ts) and, on a cold
// serverless instance, first pays the local embedding model's one-time
// load cost — comfortably past the 10s platform default for a
// full-length article. 60s is the ceiling Vercel allows without a Pro
// plan and covers this worst case (cold model load + a full article's
// passages) with headroom.
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 800;
const MAX_HISTORY_TURNS = 6;
/** Passages retrieved per question. */
const PASSAGE_LIMIT = 8;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;

  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`article-chat:${ip}`, 8, 300);
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

  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({
      where: { id: articleId },
      select: { ...ARTICLE_RECORD_SELECT, status: true },
    })
  );
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (!anyLLMAvailable()) {
    console.warn("[article-chat] no LLM provider configured (set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or LLM_BASE_URL/LLM_API_KEY)");
    return NextResponse.json({
      mode: "unavailable",
      message: "AI chat is temporarily unavailable for this article — please try again in a few minutes.",
    });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const historyBlock = formatHistory(history);

  let chunks = await retrieveChunks(articleId, question, PASSAGE_LIMIT);
  if (chunks.length === 0) {
    try {
      const indexResult = await indexArticleChunks(articleId);
      if (indexResult.chunkCount > 0) {
        chunks = await retrieveChunks(articleId, question, PASSAGE_LIMIT);
      }
    } catch (e) {
      console.error(`[article-chat] on-demand indexing failed for article ${articleId}:`, e);
    }
  }
  if (chunks.length === 0) {
    return NextResponse.json({
      mode: "not-indexed",
      message: "This article couldn't be indexed for chat — it may have no readable galley text yet. Ask an editor to check its production files.",
    });
  }

  const passageBlock = `PASSAGES (excerpts from the paper's full text):\n\n${chunks
    .map((c, i) => `[Passage ${i + 1}]\n${c.text}`)
    .join("\n\n")}`;

  const systemPrompt =
    `You are a research assistant answering questions about one published academic paper, "${article.title}". ` +
    "Use ONLY the ARTICLE RECORD (title, authors, date, DOI, keywords, abstract) and the PASSAGES (excerpts from its full text) provided in the message. " +
    "If the reader asks about a different paper or a topic this paper doesn't cover, say so.\n" +
    GROUNDING_RULES;

  const userPrompt = `ARTICLE RECORD:\n${formatArticleRecord(article)}\n\n${passageBlock}${historyBlock}\n\nReader's question: ${question}`;

  try {
    const result = await chatJSON<{ answer: string; usedPassages?: number[]; grounded?: boolean }>(
      systemPrompt,
      userPrompt,
      { maxTokens: 1000, priority: "cost-first", temperature: 0.1 }
    );

    const usedPassages = normalizeUsedPassages(result.data.usedPassages);
    const citedChunks = usedPassages
      .map((n) => chunks[n - 1])
      .filter((c): c is (typeof chunks)[number] => !!c)
      .map((c) => ({ chunkIndex: c.chunkIndex, text: c.text, matchType: c.matchType }));

    return NextResponse.json({
      mode: "answered",
      answer: result.data.answer,
      grounded: result.data.grounded !== false,
      citedChunks,
      model: result.model,
    });
  } catch (e: any) {
    // The underlying failure (a provider outage, an exhausted API credit
    // balance, a malformed response) is an operational detail for whoever
    // runs this deployment, not something a reader asking a question
    // should see verbatim — this used to return e.message directly (a
    // raw upstream API error, e.g. Anthropic's own "credit balance is too
    // low" JSON) in a 502, which apiFetch then surfaced as-is in a toast.
    // Logged in full here; the reader gets the same honest-but-friendly
    // "unavailable" shape every other non-answer path in this route
    // already uses, which the client already renders as a banner instead
    // of a toast.
    console.error(`[article-chat] chat failed for article ${articleId}:`, e);
    return NextResponse.json({
      mode: "unavailable",
      message: "AI chat is temporarily unavailable for this article — please try again in a few minutes.",
    });
  }
}
