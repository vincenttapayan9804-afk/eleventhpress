import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { isLLMAvailable, chatJSON } from "@/lib/llm";
import { retrieveChunks, indexArticleChunks } from "@/lib/chunk-embeddings";

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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const MAX_QUESTION_LENGTH = 800;
const MAX_HISTORY_TURNS = 6;

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

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { id: true, status: true, title: true },
  });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (!isLLMAvailable()) {
    return NextResponse.json({
      mode: "unavailable",
      message: "AI chat is not configured for this deployment (no ANTHROPIC_API_KEY set).",
    });
  }

  let chunks = await retrieveChunks(articleId, question, 6);
  if (chunks.length === 0) {
    try {
      const indexResult = await indexArticleChunks(articleId);
      if (indexResult.chunkCount > 0) {
        chunks = await retrieveChunks(articleId, question, 6);
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

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const historyBlock = history.length
    ? `\n\nPrior conversation (for context only — still answer only from the passages below):\n${history
        .map((t) => `${t.role === "user" ? "Reader" : "You"}: ${t.content}`)
        .join("\n")}`
    : "";

  const passageBlock = chunks
    .map((c, i) => `[Passage ${i + 1}]\n${c.text}`)
    .join("\n\n");

  const systemPrompt =
    `You are a research assistant answering questions about a single published academic paper, "${article.title}". ` +
    `You may ONLY use the passages provided below — they are the only excerpts of this paper you have access to. ` +
    `If the passages don't contain enough information to answer, say so plainly instead of guessing or using outside knowledge. ` +
    `Never invent a citation, statistic, or claim that isn't directly supported by the passages. ` +
    `Reply with a JSON object: {"answer": string, "usedPassages": number[], "grounded": boolean}. ` +
    `"usedPassages" is the 1-based list of passage numbers you actually drew on. ` +
    `"grounded" is false only if you had to tell the reader the passages don't cover their question.`;

  const userPrompt = `${passageBlock}${historyBlock}\n\nReader's question: ${question}`;

  try {
    const result = await chatJSON<{ answer: string; usedPassages?: number[]; grounded?: boolean }>(
      systemPrompt,
      userPrompt,
      { maxTokens: 700 }
    );

    const usedPassages = Array.isArray(result.data.usedPassages) ? result.data.usedPassages : [];
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
    console.error(`[article-chat] chat failed for article ${articleId}:`, e);
    return NextResponse.json({ error: e?.message || "Chat request failed" }, { status: 502 });
  }
}
