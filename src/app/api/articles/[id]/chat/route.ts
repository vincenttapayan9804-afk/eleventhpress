import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { chatJSON, anyLLMAvailable } from "@/lib/llm";
import { retrieveChunks, indexArticleChunks, loadCorpusChunksByIds, type RetrievedChunk } from "@/lib/chunk-embeddings";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { APP_BASE_URL } from "@/lib/site";
import { ARTICLE_RECORD_SELECT, formatArticleRecord, formatHistory, normalizeUsedPassages } from "@/lib/rag-prompt";
import { analyzeQuestion, cleanSourceIds, type QuestionIntent } from "@/lib/research-query";
import {
  finalizeSuggestions,
  remainingSectionQuestions,
  sectionRetrievalHints,
  shortTitle,
  MAX_SUGGESTIONS,
  SECTION_NAMES,
} from "@/lib/suggested-questions";
import {
  apaReference,
  resolveCitations,
  stripModelReferenceList,
  verifyAnswer,
  type EvidenceArticle,
} from "@/lib/answer-integrity";
import { loadJournalInfo } from "@/lib/research-assistant";

/**
 * POST /api/articles/[id]/chat — "Ask this paper": the AI Research
 * Assistant scoped to one published article.
 *
 * Runs the same pipeline as Ask the Corpus (/api/corpus-chat), restricted
 * to this article:
 * 1. works out what kind of question it is (a bibliographic lookup, one
 *    part of the paper, a substantive research question);
 * 2. retrieves this article's most relevant passages with hybrid keyword +
 *    semantic search (a follow-up such as "what were its limitations?" is
 *    retrieved together with the reader's previous question);
 * 3. gives the model the article's bibliographic record and the passages,
 *    with rules that make them the only evidence it may use;
 * 4. calls the configured provider (OpenRouter's free models by default,
 *    see src/lib/llm.ts), retrying once if the reply is malformed;
 * 5. turns the model's [P3]/[A1] markers into numbered citations, drops any
 *    that point at evidence it wasn't given, checks DOIs, quotations and
 *    figures against the source text, and builds the APA reference from
 *    the journal's own metadata;
 * 6. returns the answer with its citations, the evidence ids (so
 *    "Regenerate" reuses exactly that evidence) and follow-up questions,
 *    including one per part of the paper not yet asked about.
 *
 * Public (the article is open access) and rate-limited per IP. Readers
 * never see a raw provider error: every operational failure returns the
 * same friendly "unavailable" message, with the cause logged server-side.
 *
 * Every PUBLISHED article is chunk-indexed at publish time and on each
 * production build; on a cache miss this route indexes on demand and
 * retries once, so a reader is never stuck waiting for the next deploy.
 */

// On-demand indexing (cold embedding model + a full article's passages)
// plus one model call and a possible retry; 60s is the Hobby ceiling.
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 800;
const MAX_HISTORY_TURNS = 6;
/** Passages retrieved per question. */
const PASSAGE_LIMIT = 8;
const MAX_EVIDENCE_IDS = 16;
/** Ask once more if the first reply fails, while there's time left. */
const RETRY_IF_FAILED_WITHIN_MS = 25_000;

const UNAVAILABLE_MESSAGE = "AI chat is temporarily unavailable for this article. Please try again in a few minutes.";

const RECORD_SELECT = {
  ...ARTICLE_RECORD_SELECT,
  status: true,
  issue: { select: { volume: true, issueNumber: true } },
} as const;

type HistoryTurn = { role: "user" | "assistant"; content: string };

function cleanHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: String(t.content).slice(0, 4000) }));
}

/** Within one paper a "comparison" or "overview" is a substantive question. */
type PaperIntent = Exclude<QuestionIntent, "comparison" | "overview">;

function paperIntent(intent: QuestionIntent): PaperIntent {
  return intent === "bibliographic" || intent === "section" ? intent : "general";
}

const INTENT_NOTES: Record<PaperIntent, string> = {
  bibliographic: "Question type: a factual or bibliographic lookup. Answer briefly, without headings.",
  section: "Question type: about a specific part of the paper. Answer from that part of the paper.",
  general: "Question type: a substantive research question about the paper.",
};

const SYSTEM_PROMPT = (journalName: string, title: string) =>
  [
    `You are the AI Research Assistant of ${journalName}, an academic journal, answering a reader's questions about one published article: "${title}". Use ONLY the ARTICLE RECORD ([A1]: title, authors, date, DOI, keywords, abstract) and the PASSAGES ([P1], [P2], …: excerpts of the article's full text) in the message. They are the exclusive evidence for anything you say about this article.`,
    "",
    "How to work: (1) work out what the reader is really asking; (2) identify the passages that bear on it and check each is actually relevant, ignoring the rest; (3) read a passage in the context of the whole article, and prefer what the article as a whole says over an isolated sentence; (4) answer, citing the evidence.",
    "",
    "Evidence and knowledge boundary:",
    "- Every factual statement about the article must be supported by the record or passages. Never use outside knowledge to fill a gap, and never present general knowledge as something this article says.",
    "- If the reader asks about a different paper or a topic this article doesn't cover, say so plainly and set grounded to false.",
    "- Never fabricate findings, authors, titles, dates, DOIs, statistical results, methods, quotations, page numbers, citations or references.",
    "- Reproduce numbers, statistics, sample sizes, dates and names exactly as written; never round, convert or estimate them. Quote only words that appear verbatim in a passage.",
    "- If the evidence only partly answers the question, answer that part and say plainly what it doesn't establish (\"The article doesn't state …\").",
    "",
    "Citations:",
    "- Put a citation right after every major factual claim: [P4] for a passage, [A1] for the article record, several as [P4][P7]. Cite only passage numbers that exist in the message.",
    "- Do not write a reference list; the platform builds it from your citations and the journal's verified metadata.",
    "",
    "Academic standards: rigorous, objective, neutral and appropriately qualified. Preserve the authors' meaning; never exaggerate conclusions, generalise beyond the study's sample and setting, or present correlation as causation. Report significance and effect sizes as the authors give them.",
    "Keep documented findings (what the article reports, always cited) distinct from interpretation (your own reading, only under a \"### Research interpretation\" heading, which begins \"*AI interpretation, not stated by the authors:*\").",
    "",
    "Response structure (Markdown in \"answer\"), adapted to the question — never pad a simple answer:",
    "- Simple factual or bibliographic question: one to three sentences with citations, no headings.",
    "- Substantive question: open with the direct answer in 2–4 sentences (no heading). Then add only the sections that add value, in this order: \"### Supporting evidence\" (bullet points, each cited), \"### Research interpretation\", \"### Limitations\" (of the study, and of the evidence available here).",
    "",
    "Conversation: earlier turns are only for understanding references such as \"those findings\" or \"the second instrument\". Never treat an earlier answer as evidence: verify every claim against the evidence in this message.",
    "",
    `Also give "suggestedQuestions": up to ${MAX_SUGGESTIONS} short, specific follow-up questions about this article, each on a different part of the paper (${SECTION_NAMES.join(", ")}), using its actual content (topic, variables, setting, instruments, findings) rather than generic wording, and answerable from this article. Do not repeat the reader's question.`,
    "",
    'Reply with only a JSON object: {"answer": string (Markdown), "usedPassages": number[] (every passage you drew on), "grounded": boolean (false only when the evidence does not answer the question), "suggestedQuestions": string[]}.',
  ].join("\n");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;

  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`article-chat:${ip}`, 8, 300);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  let body: { question?: unknown; history?: unknown; evidenceIds?: unknown; regenerate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (typeof body.question === "string" ? body.question : "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` }, { status: 400 });
  }

  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({ where: { id: articleId }, select: RECORD_SELECT })
  );
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (!anyLLMAvailable()) {
    console.warn("[article-chat] no LLM provider configured (set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or LLM_BASE_URL/LLM_API_KEY)");
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }

  const history = cleanHistory(body.history);
  const historyBlock = formatHistory(history);
  const analysis = analyzeQuestion(question);
  const intent = paperIntent(analysis.intent);
  const regenerate = body.regenerate === true;
  const evidenceIds = cleanSourceIds(body.evidenceIds, MAX_EVIDENCE_IDS);

  let chunks: RetrievedChunk[] = [];
  try {
    // "Regenerate": the same evidence as the earlier answer (this article's only).
    if (regenerate && evidenceIds.length > 0) {
      chunks = (await loadCorpusChunksByIds(evidenceIds)).filter((c) => c.articleId === articleId);
    }
    if (chunks.length === 0) {
      const previousQuestion = analysis.refersToContext
        ? [...history].reverse().find((t) => t.role === "user")?.content ?? ""
        : "";
      const retrievalQuery = [question, previousQuestion.slice(0, MAX_QUESTION_LENGTH), sectionRetrievalHints(question)]
        .filter((part) => part.trim())
        .join("\n");
      chunks = await retrieveChunks(articleId, retrievalQuery, PASSAGE_LIMIT);
      if (chunks.length === 0) {
        try {
          const indexResult = await indexArticleChunks(articleId);
          if (indexResult.chunkCount > 0) chunks = await retrieveChunks(articleId, retrievalQuery, PASSAGE_LIMIT);
        } catch (e) {
          console.error(`[article-chat] on-demand indexing failed for article ${articleId}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`[article-chat] retrieval failed for article ${articleId}:`, e);
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
  if (chunks.length === 0) {
    return NextResponse.json({
      mode: "not-indexed",
      message: "This article couldn't be indexed for chat. It may have no readable galley text yet; ask an editor to check its production files.",
    });
  }

  const journal = await loadJournalInfo(tenant && !tenant.isPlatform ? tenant.id : null);
  const passageBlock = `PASSAGES (excerpts from the article's full text):\n\n${chunks
    .map((c, i) => `[P${i + 1}]\n${c.text}`)
    .join("\n\n")}`;
  const regenerateNote = regenerate
    ? "\n\nThis is a regenerated answer: write a fresh response from the same evidence, organised and worded independently of any earlier answer."
    : "";

  const systemPrompt = SYSTEM_PROMPT(journal.name, article.title);
  const userPrompt = `ARTICLE RECORD:\n${formatArticleRecord(article, "A1")}\n\n${passageBlock}${historyBlock}\n\n${INTENT_NOTES[intent]}${regenerateNote}\n\nReader's question: ${question}`;

  try {
    const ask = () =>
      chatJSON<{ answer: string; usedPassages?: number[]; grounded?: boolean; suggestedQuestions?: unknown }>(systemPrompt, userPrompt, {
        maxTokens: 2000,
        priority: "cost-first",
        temperature: regenerate ? 0.5 : 0.1,
      });
    const started = Date.now();
    const hasAnswer = (r: Awaited<ReturnType<typeof ask>>) => typeof r.data?.answer === "string" && r.data.answer.trim().length > 0;
    let result: Awaited<ReturnType<typeof ask>>;
    try {
      result = await ask();
      if (!hasAnswer(result)) throw new Error("model reply had no answer text");
    } catch (first) {
      if (Date.now() - started > RETRY_IF_FAILED_WITHIN_MS) throw first;
      console.warn(`[article-chat] first attempt failed for article ${articleId}, retrying once:`, first);
      result = await ask();
      if (!hasAnswer(result)) throw new Error("model reply had no answer text");
    }

    const grounded = result.data.grounded !== false;
    let usedPassages = normalizeUsedPassages(result.data.usedPassages);
    // An answer drawn only from the record (e.g. "who wrote this?") still
    // points at the paper's earliest retrieved passage.
    if (usedPassages.length === 0 && grounded) {
      const earliest = chunks.reduce((best, c, i) => (c.chunkIndex < chunks[best].chunkIndex ? i : best), 0);
      usedPassages = [earliest + 1];
    }

    const evidenceArticle: EvidenceArticle = {
      ...article,
      label: "A1",
      volume: article.issue?.volume ?? null,
      issueNumber: article.issue?.issueNumber ?? null,
    };
    const cited = resolveCitations(
      stripModelReferenceList(result.data.answer),
      chunks.map((c) => ({ chunkId: c.chunkId, articleId, articleTitle: article.title, chunkIndex: c.chunkIndex, text: c.text })),
      [evidenceArticle],
      usedPassages,
      APP_BASE_URL
    );
    const sources = cited.sources.map((s) => ({
      ...s,
      reference: apaReference(s, { name: journal.name, volume: evidenceArticle.volume, issueNumber: evidenceArticle.issueNumber }),
    }));
    const verified = verifyAnswer(
      cited.answer,
      [...chunks.map((c) => c.text), formatArticleRecord(article)],
      [article.doi ?? ""],
      grounded,
      cited.citations.length
    );
    if (cited.droppedMarkers > 0) {
      verified.check.warnings.unshift(
        `Removed ${cited.droppedMarkers === 1 ? "a citation" : `${cited.droppedMarkers} citations`} that pointed at evidence the assistant wasn't given.`
      );
      if (verified.check.status === "verified") verified.check.status = "review";
    }

    console.info(
      `[article-chat] answered by ${result.provider}/${result.model}; article=${articleId}, intent=${intent}, ${chunks.length} passages, ${cited.citations.length} citations, evidence=${verified.check.status}`
    );

    const asked = [question, ...history.filter((t) => t.role === "user").map((t) => t.content)];
    const sectionQuestions = remainingSectionQuestions(article.title, asked);
    const suggestedQuestions = finalizeSuggestions(result.data.suggestedQuestions, asked, sectionQuestions);

    return NextResponse.json({
      mode: "answered",
      answer: verified.answer,
      grounded,
      intent,
      citations: cited.citations,
      sources,
      evidence: { ...verified.check, passagesReviewed: chunks.length, articlesReviewed: 1 },
      evidenceIds: chunks.map((c) => c.chunkId),
      suggestedQuestions,
      sectionQuestions,
      sectionArticle: shortTitle(article.title),
      sectionArticleId: articleId,
      model: result.model,
      answeredAt: new Date().toISOString(),
    });
  } catch (e) {
    // A provider outage, a rejected key, an exhausted balance or a
    // malformed reply: logged in full, reader gets the friendly banner.
    console.error(`[article-chat] chat failed for article ${articleId}:`, e);
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
}
