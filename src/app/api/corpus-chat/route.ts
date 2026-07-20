import { NextRequest, NextResponse } from "next/server";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";
import { retrieveChunksAcrossCorpus } from "@/lib/chunk-embeddings";

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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const MAX_QUESTION_LENGTH = 800;
const MAX_HISTORY_TURNS = 6;

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
    return NextResponse.json({
      mode: "unavailable",
      message: "AI chat is not configured for this deployment (no ANTHROPIC_API_KEY or OPENROUTER_API_KEY set).",
    });
  }

  const chunks = await retrieveChunksAcrossCorpus(question, 8);
  if (chunks.length === 0) {
    return NextResponse.json({
      mode: "not-indexed",
      message: "No published articles are indexed for chat yet.",
    });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const historyBlock = history.length
    ? `\n\nPrior conversation (for context only — still answer only from the passages below):\n${history
        .map((t) => `${t.role === "user" ? "Reader" : "You"}: ${t.content}`)
        .join("\n")}`
    : "";

  const passageBlock = chunks
    .map((c, i) => `[Passage ${i + 1}, from "${c.articleTitle}"]\n${c.text}`)
    .join("\n\n");

  const systemPrompt =
    `You are a research assistant answering questions across an entire academic journal's published articles. ` +
    `You may ONLY use the passages provided below — they are excerpts from this journal's own published articles, each labeled with the article it came from. ` +
    `If the passages don't contain enough information to answer, say so plainly instead of guessing or using outside knowledge. ` +
    `Never invent a citation, statistic, or claim that isn't directly supported by the passages. When passages from multiple articles are relevant, synthesize across them and attribute each claim to its source article by name. ` +
    `Reply with a JSON object: {"answer": string, "usedPassages": number[], "grounded": boolean}. ` +
    `"usedPassages" is the 1-based list of passage numbers you actually drew on. ` +
    `"grounded" is false only if you had to tell the reader the passages don't cover their question.`;

  const userPrompt = `${passageBlock}${historyBlock}\n\nReader's question: ${question}`;

  try {
    const result = await chatJSON<{ answer: string; usedPassages?: number[]; grounded?: boolean }>(
      systemPrompt,
      userPrompt,
      { maxTokens: 900 }
    );

    const usedPassages = Array.isArray(result.data.usedPassages) ? result.data.usedPassages : [];
    const citedChunks = usedPassages
      .map((n) => chunks[n - 1])
      .filter((c): c is (typeof chunks)[number] => !!c)
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
      grounded: result.data.grounded !== false,
      citedChunks,
      model: result.model,
    });
  } catch (e: any) {
    console.error("[corpus-chat] chat failed:", e);
    return NextResponse.json({ error: e?.message || "Chat request failed" }, { status: 502 });
  }
}
