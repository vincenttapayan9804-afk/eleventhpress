import { NextRequest, NextResponse } from "next/server";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { anyStreamProvider, streamChat, StreamInterruptedError, type StreamChatResult } from "@/lib/llm-stream";
import { isGrounded, NOT_COVERED_OPENING, splitAnswer, usedPassagesFromMarkers, visibleLength, FOLLOW_UPS_MARKER } from "@/lib/answer-format";
import { sectionsForQuestion } from "@/lib/section-chunker";
import { passageLocation } from "@/lib/answer-integrity";
import { loadCorpusChunksByIds, retrieveChunksAcrossCorpus, type CorpusRetrievedChunk } from "@/lib/chunk-embeddings";
import { db } from "@/lib/db";
import { correctionWarnings, loadCorrections } from "@/lib/source-signals";
import { getSessionFromHeaders } from "@/lib/auth";
import { resolveTenantFromHeaders, tenantCacheControl, type TenantContext } from "@/lib/tenant";
import { APP_BASE_URL } from "@/lib/site";
import { parseAuthors } from "@/lib/article";
import {
  finalizeSuggestions,
  remainingSectionQuestions,
  sectionRetrievalHints,
  shortTitle,
  starterPrompts,
  MAX_SUGGESTIONS,
  SECTION_NAMES,
} from "@/lib/suggested-questions";
import { ARTICLE_RECORD_SELECT, formatArticleRecord, formatHistory } from "@/lib/rag-prompt";
import { analyzeQuestion, cleanSourceIds, resolveContextArticles, retrievalPlan, type ContextTurn, type QuestionIntent } from "@/lib/research-query";
import {
  apaReference,
  resolveCitations,
  stripModelReferenceList,
  verifyAnswer,
  type EvidenceArticle,
} from "@/lib/answer-integrity";
import { loadJournalInfo } from "@/lib/research-assistant";
import {
  cleanScope,
  corpusArticleWhere,
  coverageOf,
  describeScope,
  getAssistantSettings,
  logResearchQuery,
  type AssistantSettings,
  type CorpusScope,
} from "@/lib/research-assistant-settings";

/**
 * POST /api/corpus-chat — the journal's AI Research Assistant ("Ask the
 * Corpus"), a retrieval-augmented chat over every published article.
 *
 * For each question it:
 * 1. works out what kind of question it is (a factual or bibliographic
 *    lookup, one part of a paper, a comparison across papers, an overview)
 *    and whether it refers back to articles already discussed ("this
 *    article", "the second study", "the same author");
 * 2. retrieves passages across every PUBLISHED article with hybrid
 *    keyword + semantic search, focused on the article(s) the question
 *    names or refers to, and wider and more even for comparisons;
 * 3. gives the model each source article's bibliographic record (title,
 *    authors, date, DOI, keywords, abstract) with the passages, and rules
 *    that make those records the only evidence it may use;
 * 4. turns the model's inline [P3]/[A1] markers into numbered citations,
 *    discarding any that point at evidence it wasn't given, and checks
 *    DOIs, quotations, page numbers and figures against the source text;
 * 5. returns the answer with verified sources (APA references built from
 *    the journal's own metadata), links to the supporting passages, the
 *    ids of all the evidence used (so "Regenerate" can reuse exactly that
 *    evidence) and follow-up questions.
 *
 * Public, no login required (the content is open access). Searches only
 * the institution's own published articles (the tenant the request belongs
 * to), optionally narrowed by the reader's scope (disciplines, years, an
 * issue, chosen articles). Quotas are per account for signed-in readers and
 * per network address otherwise, both set per institution
 * (ResearchAssistantSettings).
 *
 * With `Accept: application/x-ndjson` the reply is streamed as one JSON
 * object per line: {"type":"stage",...} as each step starts,
 * {"type":"delta","text":...} for each piece of the answer as the model
 * writes it, then {"type":"result",...} with the same body the JSON reply
 * has (the verified answer, which replaces the streamed text). Closing the
 * connection (the reader pressed Stop) cancels the model request.
 *
 * Models come from src/lib/llm-stream.ts: a self-hosted open model, pinned
 * free OpenRouter models, then Anthropic, whichever are configured. Every
 * question has a time budget (50 s, CORPUS_CHAT_DEADLINE_MS) inside the function's
 * maxDuration: when it runs out, the text written so far is verified and
 * returned marked incomplete instead of the request being cut off.
 */
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 800;

/** What readers see whenever no answer can be produced for an operational
 * reason (no provider configured, a provider outage, a rejected or expired
 * API key, a retrieval error). The real cause is logged server-side only. */
const UNAVAILABLE_MESSAGE =
  "The Research Assistant is temporarily unavailable. Please try again in a few minutes, or browse and search the published articles directly.";
/** No text at all within the time budget. */
const TIMEOUT_MESSAGE =
  "This question took longer than the Research Assistant's time limit. Try narrowing it (fewer articles, one discipline or one aspect), or ask again in a moment.";
const MAX_HISTORY_TURNS = 6;
/** Ask again once if every provider failed before writing anything, as long
 * as there's time left within maxDuration. */
const RETRY_IF_FAILED_WITHIN_MS = 25_000;
/** The whole answer must be ready this long after the request arrives, so
 * the reader gets a result (complete or marked incomplete) before the
 * platform's maxDuration cuts the function off. Capped below maxDuration. */
function answerDeadlineMs(): number {
  const n = Number(process.env.CORPUS_CHAT_DEADLINE_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 55_000) : 50_000;
}
const MAX_EVIDENCE_IDS = 16;

const RECORD_SELECT = {
  ...ARTICLE_RECORD_SELECT,
  issue: { select: { volume: true, issueNumber: true } },
} as const;

type RecordRow = {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  keywords: string;
  doi: string | null;
  publishedAt: Date | null;
  discipline: string;
  issue?: { volume: number; issueNumber: number } | null;
};

/** Bibliographic records for the given articles, in order. Best effort: a
 * lookup failure means the answer relies on the passages alone. */
async function loadArticleRecords(ids: string[], where: Record<string, unknown> = { status: "PUBLISHED" }): Promise<RecordRow[]> {
  if (ids.length === 0) return [];
  try {
    const rows = (await db.article.findMany({
      where: { ...where, id: { in: ids } } as any,
      select: RECORD_SELECT,
    })) as RecordRow[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is RecordRow => !!r);
  } catch (e) {
    console.error("[corpus-chat] article records lookup failed:", e);
    return [];
  }
}

function cleanHistory(raw: unknown): ContextTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({
      role: t.role,
      content: String(t.content).slice(0, 4000),
      ...(t.role === "assistant" ? { sources: cleanSourceIds(t.sources) } : {}),
    }));
}

const INTENT_NOTES: Record<QuestionIntent, string> = {
  bibliographic: "Question type: a factual or bibliographic lookup. Answer briefly, without headings.",
  section: "Question type: about a specific part of a paper. Answer from that part of the paper.",
  comparison:
    "Question type: a comparison or synthesis across articles. Use the comparison structure, and identify each relevant article before comparing.",
  overview: "Question type: an overview of the journal's articles. Group articles by theme and cite each one you mention.",
  general: "Question type: a substantive research question.",
};

const SYSTEM_PROMPT = (journalName: string) =>
  [
    `You are the AI Research Assistant of ${journalName}, an academic journal. You answer readers' questions using ONLY the journal records in the message: ARTICLE RECORDS ([A1], [A2], …: title, authors, date, DOI, keywords, abstract) and PASSAGES ([P1], [P2], …: excerpts of the published full text). These records are the exclusive evidence for anything you say about the journal's articles.`,
    "",
    "How to work: (1) work out what the reader is really asking; (2) identify the records and passages that bear on it and check that each is actually relevant, ignoring the rest; (3) read a passage in the context of its article's record, and prefer what the article as a whole says over an isolated sentence; (4) answer, citing the evidence.",
    "",
    "Evidence and knowledge boundary:",
    "- Every factual statement about an article must be supported by the records. Never use outside knowledge to fill a gap, and never present general knowledge as something the journal published.",
    "- Never fabricate research findings, authors, article titles, publication dates, DOIs, statistical results, methods, quotations, page numbers, citations or references.",
    "- Reproduce numbers, statistics, sample sizes, dates and names exactly as written; never round, convert or estimate them. Quote only words that appear verbatim in a passage.",
    "- If the records only partly answer the question, answer that part and say plainly what they don't establish (\"The journal's records don't state …\"). If they don't answer it at all, say so using the opening given under Output format.",
    "",
    "Citations:",
    "- Put a citation right after every major factual claim: [P4] for a passage, [A2] for an article record, several as [P4][P7]. Cite only passage and article numbers that exist in the message.",
    "- Do not write a reference list; the platform builds it from your citations and the journal's verified metadata.",
    "",
    "Academic standards: rigorous, objective, neutral and appropriately qualified. Preserve the authors' meaning; never exaggerate conclusions, generalise beyond a study's sample and setting, or present correlation as causation. Report significance and effect sizes as the authors give them.",
    "Keep three kinds of statement distinct:",
    "- Documented findings: what an article reports, always cited.",
    "- Cross-article synthesis: your comparison of what several articles report; introduce it as such (e.g. \"Across these studies, …\") and cite every article involved.",
    "- Interpretation: your own reading, only under a \"### Research interpretation\" heading, which begins \"*AI interpretation, not stated by the authors:*\".",
    "",
    "Response structure (Markdown in \"answer\"), adapted to the question — never pad a simple answer:",
    "- Simple factual or bibliographic question: one to three sentences with citations, no headings.",
    "- Substantive question: open with the direct answer in 2–4 sentences (no heading). Then add only the sections that add value, in this order: \"### Supporting evidence\" (bullet points, each cited), \"### Comparative analysis\" (only if more than one article is relevant), \"### Research interpretation\", \"### Limitations\" (of the studies, and of the evidence available here).",
    "- Comparison or synthesis: open with the direct answer, then \"### Articles compared\" as a Markdown table with columns Article | Objective | Design & methods | Population & context | Key findings (cite in the cells), then \"### Similarities and differences\", \"### Conflicting findings\" (say if none were found), \"### Methodological limitations\" and \"### Evidence-supported synthesis\". Do not claim a consensus the evidence doesn't show. If only one relevant article is in the records, say a comparison isn't possible from the journal's records.",
    "- Refer to articles by a short form of their title in italics or quotation marks.",
    "- Be concise: most answers fit in 150–400 words and a comparison in about 600. Prefer a tight table and bullet points to long paragraphs.",
    "",
    "Conversation: earlier turns are only for understanding references such as \"this article\", \"the previous study\", \"those findings\", \"the second methodology\" or \"the same author\" (see RESOLVED REFERENCES when present). Never treat an earlier answer as evidence: verify every claim against the records in this message.",
    "",
    `After the answer, write a line containing only ${FOLLOW_UPS_MARKER} and then up to ${MAX_SUGGESTIONS} short, specific follow-up questions, one per line starting with "- ", about the article(s) your answer is about, each on a different part of the paper (${SECTION_NAMES.join(", ")}) or a comparison with another article in the records, naming the article by a short form of its title, using its actual content (topic, variables, setting, instruments, findings) rather than generic wording, and answerable from these records. Do not repeat the reader's question.`,
    "",
    `Output format: the answer in Markdown (no JSON, no preamble, no reference list), citing with the [P…]/[A…] markers; then the ${FOLLOW_UPS_MARKER} section. If the records don't answer the question at all, begin the answer with exactly "${NOT_COVERED_OPENING}" and then say briefly what the journal's records do cover that is closest.`,
  ].join("\n");

/**
 * GET /api/corpus-chat — the assistant's masthead (journal name, ISSN,
 * publisher, number of published articles) and ready-made research
 * prompts about the journal's newest articles for the empty chat.
 */
/** What readers see when the institution has switched the assistant off. */
const DISABLED_MESSAGE = "The Research Assistant isn't available on this journal's site. You can still browse and search the published articles.";

/** Articles of this tenant (the platform included), or every journal when the tenant can't be resolved. */
function tenantScopeId(tenant: TenantContext | null): string | null {
  return tenant?.id ?? null;
}

/** Disciplines, publication years and issues a reader can narrow the search to. */
async function loadFacets(where: Record<string, unknown>) {
  // Each lookup is best effort: a failure leaves that filter empty.
  const safe = <T,>(fn: () => Promise<T>, fallback: T) => Promise.resolve().then(fn).catch(() => fallback);
  const [disciplines, years, issues] = await Promise.all([
    safe(() => db.article
      .findMany({ where: where as any, distinct: ["discipline"], select: { discipline: true }, take: 60 })
      .then((rows: { discipline?: string | null }[]) => [...new Set(rows.map((r) => r.discipline).filter((d): d is string => !!d))].sort()), [] as string[]),
    safe(() => db.article
      .aggregate({ where: where as any, _min: { publishedAt: true }, _max: { publishedAt: true } })
      .then((a: any) =>
        a?._min?.publishedAt && a?._max?.publishedAt
          ? { min: new Date(a._min.publishedAt).getUTCFullYear(), max: new Date(a._max.publishedAt).getUTCFullYear() }
          : null
      ), null as { min: number; max: number } | null),
    safe(() => db.issue
      .findMany({
        where: { articles: { some: where as any } },
        orderBy: [{ year: "desc" }, { volume: "desc" }, { issueNumber: "desc" }],
        select: { id: true, volume: true, issueNumber: true, year: true, title: true },
        take: 40,
      })
      .then((rows: { id: string; volume: number; issueNumber: number; year: number; title: string | null }[]) =>
        rows.map((r) => ({ id: r.id, label: `Vol. ${r.volume}, No. ${r.issueNumber} (${r.year})${r.title ? ` · ${r.title}` : ""}` }))
      ), [] as { id: string; label: string }[]),
  ]);
  return { disciplines, years, issues };
}

/**
 * GET /api/corpus-chat — the assistant's masthead (journal name, ISSN,
 * publisher, number of published articles), ready-made research prompts
 * (the editors' own first), what a reader can narrow the search to, and
 * the institution's assistant settings that readers see.
 */
export async function GET(req?: NextRequest) {
  const tenant = req ? await resolveTenantFromHeaders(req.headers).catch(() => null) : null;
  const tenantId = tenant && !tenant.isPlatform ? tenant.id : null;
  const where = corpusArticleWhere(tenantScopeId(tenant), null);
  const cacheValue = "public, s-maxage=60, stale-while-revalidate=600";
  const settings = await getAssistantSettings(tenantScopeId(tenant));
  const assistant = { enabled: settings.enabled, disclaimer: settings.disclaimer };
  try {
    const [recent, articleCount, journal, facets] = await Promise.all([
      db.article.findMany({
        where: where as any,
        orderBy: { publishedAt: "desc" },
        take: 4,
        select: { title: true },
      }),
      db.article.count({ where: where as any }).catch(() => null),
      loadJournalInfo(tenantId),
      loadFacets(where),
    ]);
    const editorPrompts = settings.starterQuestions.map((question) => ({ category: "Suggested by the editors" as const, question }));
    const prompts = [...editorPrompts, ...starterPrompts(recent.map((a) => a.title))];
    return NextResponse.json(
      {
        suggestedQuestions: prompts.filter((p) => p.category === "Explore a paper").map((p) => p.question).slice(0, MAX_SUGGESTIONS),
        prompts,
        journal,
        stats: { articles: articleCount },
        facets,
        assistant,
      },
      { headers: { "Cache-Control": req ? tenantCacheControl(req, tenant, cacheValue) : cacheValue } }
    );
  } catch (e) {
    console.error("[corpus-chat] starter questions failed:", e);
    return NextResponse.json({
      suggestedQuestions: [],
      prompts: [],
      journal: await loadJournalInfo(tenantId),
      stats: { articles: null },
      facets: { disciplines: [], years: null, issues: [] },
      assistant,
    });
  }
}

type Stage = "understanding" | "searching" | "reading" | "writing" | "checking";
type Emit = (stage: Stage, detail?: Record<string, unknown>) => void;

interface AskInput {
  question: string;
  history: ContextTurn[];
  regenerate: boolean;
  evidenceIds: string[];
  scope: CorpusScope | null;
  continueOf: { question: string; evidenceIds: string[] } | null;
  tenant: TenantContext | null;
  settings: AssistantSettings;
  signedIn: boolean;
  quota: Quota | null;
}

interface Quota {
  limit: number;
  remaining: number;
  resetAt: string;
  basis: "account" | "network";
}

/** Questions per hour: a signed-in reader's own quota, else per network address on this institution's site. */
async function checkQuota(req: NextRequest, tenant: TenantContext | null, settings: AssistantSettings) {
  const session = getSessionFromHeaders(req.headers);
  const tenantKey = tenant?.id ?? "none";
  const basis: Quota["basis"] = session ? "account" : "network";
  const limit = session ? settings.signedInHourlyLimit : settings.anonymousHourlyLimit;
  const key = session ? `corpus-chat:user:${session.userId}` : `corpus-chat:ip:${tenantKey}:${extractRequestIp(req.headers)}`;
  const rl = await checkRateLimit(key, limit, 3600);
  const quota: Quota | null =
    rl.mode === "live" && typeof rl.remaining === "number"
      ? { limit: rl.limit ?? limit, remaining: Math.max(0, rl.remaining), resetAt: new Date(rl.reset ?? Date.now() + 3_600_000).toISOString(), basis }
      : null;
  return { ok: rl.ok, quota, signedIn: !!session, limit, basis };
}

export async function POST(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const settings = await getAssistantSettings(tenantScopeId(tenant));
  if (!settings.enabled) {
    return NextResponse.json({ mode: "disabled", message: DISABLED_MESSAGE });
  }

  const quotaCheck = await checkQuota(req, tenant, settings);
  if (!quotaCheck.ok) {
    const resetAt = quotaCheck.quota?.resetAt ?? null;
    return NextResponse.json(
      {
        error:
          quotaCheck.basis === "account"
            ? `You've asked ${quotaCheck.limit} questions in the last hour, the limit for your account. You can ask again shortly.`
            : `This network has reached its limit of ${quotaCheck.limit} questions an hour. Sign in to get your own quota, or try again shortly.`,
        quota: quotaCheck.quota ?? { limit: quotaCheck.limit, remaining: 0, resetAt, basis: quotaCheck.basis },
      },
      { status: 429 }
    );
  }

  let body: {
    question?: string;
    history?: unknown;
    evidenceIds?: unknown;
    regenerate?: boolean;
    scope?: unknown;
    continueOf?: { question?: unknown; evidenceIds?: unknown } | null;
  };
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

  const input: AskInput = {
    question,
    history: cleanHistory(body.history),
    regenerate: body.regenerate === true,
    evidenceIds: cleanSourceIds(body.evidenceIds, MAX_EVIDENCE_IDS),
    scope: cleanScope(body.scope),
    continueOf:
      body.continueOf && typeof body.continueOf.question === "string" && body.continueOf.question.trim()
        ? { question: body.continueOf.question.trim().slice(0, MAX_QUESTION_LENGTH), evidenceIds: cleanSourceIds(body.continueOf.evidenceIds, MAX_EVIDENCE_IDS) }
        : null,
    tenant,
    settings,
    signedIn: quotaCheck.signedIn,
    quota: quotaCheck.quota,
  };

  const abort = new AbortController();
  const onClientGone = () => abort.abort();
  req.signal?.addEventListener?.("abort", onClientGone);

  const streaming = (req.headers.get("accept") ?? "").includes("application/x-ndjson");
  if (!streaming) {
    const result = await answerQuestion(input, () => {}, abort.signal);
    return NextResponse.json(result);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          // The reader has gone.
        }
      };
      try {
        const result = await answerQuestion(
          input,
          (stage, detail) => send({ type: "stage", stage, ...(detail ?? {}) }),
          abort.signal,
          (text) => send({ type: "delta", text })
        );
        send({ type: "result", ...result });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a cancel.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

/** The whole question → cited answer pipeline. Never throws: every failure is a reader-facing result. */
async function answerQuestion(input: AskInput, emit: Emit, signal: AbortSignal, onDelta?: (text: string) => void): Promise<Record<string, unknown>> {
  const started = Date.now();
  // Stops the model at the time budget as well as when the reader presses Stop.
  const deadline = AbortSignal.timeout(answerDeadlineMs());
  const modelSignal = AbortSignal.any([signal, deadline]);
  const { question, history, regenerate, evidenceIds, scope, continueOf, tenant, settings, quota } = input;
  const tenantId = tenantScopeId(tenant);
  const brandTenantId = tenant && !tenant.isPlatform ? tenant.id : null;
  const where = corpusArticleWhere(tenantId, scope);
  const log = (outcome: Parameters<typeof logResearchQuery>[0]["outcome"], extra: Partial<Parameters<typeof logResearchQuery>[0]> = {}) =>
    logResearchQuery({
      tenantId,
      signedIn: input.signedIn,
      outcome,
      latencyMs: Date.now() - started,
      scoped: !!scope,
      question,
      logQuestion: settings.logQuestions,
      ...extra,
    });
  const withQuota = (r: Record<string, unknown>) => (quota ? { ...r, quota } : r);

  if (!anyStreamProvider()) {
    console.warn("[corpus-chat] no LLM provider configured (set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or LLM_BASE_URL/LLM_API_KEY)");
    log("unavailable");
    return withQuota({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }

  emit("understanding");
  const historyBlock = formatHistory(history);
  const analysis = analyzeQuestion(question);
  const plan = retrievalPlan(analysis);
  // Chosen articles are the focus; otherwise the conversation's.
  const contextIds = scope?.articleIds?.length ? scope.articleIds.slice(0, plan.maxFocused + 2) : resolveContextArticles(analysis, history);

  let chunks: CorpusRetrievedChunk[] = [];
  try {
    emit("searching", scope ? { scope: describeScope(scope) } : {});
    // "Regenerate": the same evidence as the earlier answer.
    if (regenerate && evidenceIds.length > 0) chunks = await loadCorpusChunksByIds(evidenceIds, where);
    if (chunks.length === 0) {
      // A follow-up that refers back ("what were its limitations?") is also
      // retrieved with the reader's previous question, and "the same
      // author" with the authors' names.
      const previousQuestion = continueOf
        ? continueOf.question
        : analysis.refersToContext
          ? [...history].reverse().find((t) => t.role === "user")?.content ?? ""
          : "";
      let authorNames = "";
      if (analysis.sameAuthor && contextIds.length) {
        const ctx = await loadArticleRecords(contextIds.slice(0, 1), where);
        authorNames = ctx.flatMap((r) => parseAuthors(r.authors).map((a) => a?.name ?? "")).join(" ");
      }
      const retrievalQuery = [question, previousQuestion.slice(0, MAX_QUESTION_LENGTH), sectionRetrievalHints(question), authorNames]
        .filter((part) => part.trim())
        .join("\n");
      chunks = await retrieveChunksAcrossCorpus(retrievalQuery, plan.limit, {
        contextArticleIds: contextIds,
        maxFocused: plan.maxFocused,
        maxPerArticle: plan.maxPerArticle,
        sections: sectionsForQuestion(question),
        articleWhere: where,
        signal,
      });
      // "Continue analysis": keep the earlier answer's evidence in view
      // alongside what the new question finds.
      if (continueOf?.evidenceIds.length) {
        const earlier = await loadCorpusChunksByIds(continueOf.evidenceIds, where);
        const seen = new Set(chunks.map((c) => c.chunkId));
        chunks = [...chunks, ...earlier.filter((c) => !seen.has(c.chunkId))].slice(0, plan.limit + 6);
      }
    }
  } catch (e) {
    console.error("[corpus-chat] retrieval failed:", e);
    log("unavailable");
    return withQuota({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
  if (signal.aborted) {
    log("stopped");
    return { mode: "stopped" };
  }
  if (chunks.length === 0) {
    log("not-indexed");
    return withQuota(
      scope
        ? {
            mode: "no-match",
            message: "No published articles match the scope you set. Widen it (discipline, years, issue or chosen articles) and ask again.",
          }
        : { mode: "not-indexed", message: "No published articles are indexed for the Research Assistant yet." }
    );
  }

  // One label per source article (A1, A2, ...), shared by the records and
  // the passages so the model can tie them together.
  const articleIds = [...new Set(chunks.map((c) => c.articleId))];
  emit("reading", { passages: chunks.length, articles: articleIds.length });
  const labelOf = new Map(articleIds.map((id, i) => [id, `A${i + 1}`]));
  const [records, journal, corpusArticles, issueLabel] = await Promise.all([
    loadArticleRecords(articleIds, where),
    loadJournalInfo(brandTenantId),
    Promise.resolve().then(() => db.article.count({ where: where as any })).catch(() => null),
    scope?.issueId
      ? db.issue
          .findUnique({ where: { id: scope.issueId }, select: { volume: true, issueNumber: true, year: true } })
          .then((i: any) => (i ? `Vol. ${i.volume}, No. ${i.issueNumber} (${i.year})` : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const focusedIds = [...new Set(chunks.filter((c) => c.focused).map((c) => c.articleId))];
  const focusedTitles = focusedIds.map((id) => chunks.find((c) => c.articleId === id)!.articleTitle);
  const scopeTitles = scope?.articleIds?.length
    ? scope.articleIds.map((id) => records.find((r) => r.id === id)?.title).filter((t): t is string => !!t)
    : [];
  const scopeText = describeScope(scope, { issueLabel, articleTitles: scopeTitles });

  const recordsBlock = records.length
    ? `ARTICLE RECORDS (bibliographic details of each source article):\n\n${records
        .map((a) => formatArticleRecord(a, labelOf.get(a.id)))
        .join("\n\n")}`
    : "";
  const passageBlock = `PASSAGES (excerpts from the articles' full text):\n\n${chunks
    .map((c, i) => {
      const where = passageLocation(c);
      return `[P${i + 1} | ${labelOf.get(c.articleId)} "${c.articleTitle}"${where ? ` | ${where}` : ""}]\n${c.text}`;
    })
    .join("\n\n")}`;
  const referenced = contextIds.filter((id) => labelOf.has(id));
  const resolvedBlock =
    referenced.length && analysis.refersToContext
      ? `\n\nRESOLVED REFERENCES: the reader's question refers back to ${referenced
          .map((id) => `[${labelOf.get(id)}] "${chunks.find((c) => c.articleId === id)!.articleTitle}"`)
          .join(", ")}, discussed earlier in the conversation.`
      : "";
  const focusNote =
    focusedTitles.length && !resolvedBlock
      ? `\n\nThe reader appears to be asking about: ${focusedTitles.map((t) => `"${t}"`).join(", ")}.`
      : "";
  const scopeNote = scope
    ? `\n\nSCOPE: the reader limited the search to ${scopeText}. Answer only from these articles; if they don't answer the question, say so plainly (the rest of the journal was not searched).`
    : "";
  const continueNote = continueOf
    ? `\n\nCONTINUING AN ANALYSIS: the reader is continuing the analysis of their earlier question "${continueOf.question}". Build on that analysis: go deeper, bring in evidence and detail the earlier answer didn't cover, and connect it to the earlier findings, without repeating the earlier answer.`
    : "";
  const regenerateNote = regenerate
    ? "\n\nThis is a regenerated answer: write a fresh response from the same evidence, organised and worded independently of any earlier answer."
    : "";

  const systemPrompt = SYSTEM_PROMPT(journal.name);
  const userPrompt = `${recordsBlock}\n\n${passageBlock}${historyBlock}${resolvedBlock}${focusNote}${scopeNote}${continueNote}\n\n${INTENT_NOTES[analysis.intent]}${regenerateNote}\n\nReader's question: ${question}`;

  let modelInfo: { provider: string; model: string; firstTokenMs: number | null } | null = null;
  try {
    emit("writing");
    // Streams the answer to the reader, holding back the follow-ups section.
    let shown = 0;
    let written = "";
    const ask = () => {
      shown = 0;
      written = "";
      return streamChat(systemPrompt, userPrompt, {
        maxTokens: analysis.intent === "comparison" ? 2600 : 2000,
        temperature: regenerate ? 0.5 : 0.1,
        signal: modelSignal,
        onDelta: (text) => {
          written += text;
          const end = visibleLength(written);
          if (end > shown) {
            onDelta?.(written.slice(shown, end));
            shown = end;
          }
        },
      });
    };
    const llmStarted = Date.now();
    let result: StreamChatResult;
    let incomplete = false;
    try {
      try {
        result = await ask();
      } catch (first) {
        if (first instanceof StreamInterruptedError || modelSignal.aborted || Date.now() - llmStarted > RETRY_IF_FAILED_WITHIN_MS) throw first;
        console.warn("[corpus-chat] first attempt failed, retrying once:", first);
        result = await ask();
      }
    } catch (e) {
      // Text had started arriving: keep it, marked incomplete, unless the reader pressed Stop.
      if (e instanceof StreamInterruptedError && !signal.aborted && splitAnswer(e.partial.text).answer.trim()) {
        result = e.partial;
        incomplete = true;
      } else if (deadline.aborted && !signal.aborted) {
        log("timeout");
        return withQuota({ mode: "unavailable", message: TIMEOUT_MESSAGE });
      } else {
        throw e;
      }
    }
    modelInfo = { provider: result.provider, model: result.model, firstTokenMs: result.firstTokenMs };
    emit("checking");

    const reply = splitAnswer(result.text);
    const grounded = isGrounded(reply.answer);
    let usedPassages = usedPassagesFromMarkers(reply.answer);
    // An answer drawn only from the article records (e.g. "who wrote X?")
    // still cites its source: the named article's opening passage.
    if (usedPassages.length === 0 && grounded) {
      const opening = chunks.findIndex((c) => c.focused);
      if (opening !== -1) usedPassages = [opening + 1];
    }

    const evidenceArticles: EvidenceArticle[] = records.map((r) => ({
      ...r,
      label: labelOf.get(r.id)!,
      volume: r.issue?.volume ?? null,
      issueNumber: r.issue?.issueNumber ?? null,
    }));
    const cited = resolveCitations(
      stripModelReferenceList(reply.answer),
      chunks.map((c) => ({ chunkId: c.chunkId, articleId: c.articleId, articleTitle: c.articleTitle, chunkIndex: c.chunkIndex, text: c.text, section: c.section, headingPath: c.headingPath, kind: c.kind })),
      evidenceArticles,
      usedPassages,
      APP_BASE_URL
    );
    const issueOf = new Map(evidenceArticles.map((a) => [a.id, a]));
    const sources = cited.sources.map((s) => ({
      ...s,
      reference: apaReference(s, { name: journal.name, volume: issueOf.get(s.id)?.volume, issueNumber: issueOf.get(s.id)?.issueNumber }),
    }));
    const verified = verifyAnswer(
      cited.answer,
      [...chunks.map((c) => c.text), ...records.map((r) => formatArticleRecord(r))],
      records.map((r) => r.doi ?? ""),
      grounded,
      cited.citations.length
    );
    if (incomplete) {
      verified.check.warnings.unshift("This answer was cut short to stay within the time limit. Use “Continue analysis” to carry on from here.");
      if (verified.check.status === "verified") verified.check.status = "review";
    }
    if (cited.droppedMarkers > 0) {
      verified.check.warnings.unshift(
        `Removed ${cited.droppedMarkers === 1 ? "a citation" : `${cited.droppedMarkers} citations`} that pointed at evidence the assistant wasn't given.`
      );
      if (verified.check.status === "verified") verified.check.status = "review";
    }
    // A cited article the journal has since retracted, or flagged with an
    // expression of concern, is called out with the answer.
    const correctionNotes = correctionWarnings(sources, await loadCorrections(sources.map((s) => s.id)).catch(() => new Map()));
    if (correctionNotes.length > 0) {
      verified.check.warnings.unshift(...correctionNotes);
      if (verified.check.status === "verified") verified.check.status = "review";
    }

    console.info(
      `[corpus-chat] answered by ${result.provider}/${result.model} (first text ${result.firstTokenMs ?? "–"}ms${incomplete ? ", incomplete" : ""}); intent=${analysis.intent}, context=${contextIds.length}, ${chunks.length} passages, ${cited.citations.length} citations, evidence=${verified.check.status}${scope ? ", scoped" : ""}${continueOf ? ", continued" : ""}`
    );

    // Follow-up questions about the paper the answer is about: the article
    // the reader named or referred to, otherwise the first cited source.
    const primaryTitle = focusedTitles[0] ?? sources[0]?.title ?? chunks[0]?.articleTitle ?? null;
    const asked = [question, ...history.filter((t) => t.role === "user").map((t) => t.content)];
    const sectionQuestions = primaryTitle ? remainingSectionQuestions(primaryTitle, asked) : [];
    const suggestedQuestions = finalizeSuggestions(reply.followUps, asked, sectionQuestions);

    const coverage = {
      level: coverageOf({ grounded, citedArticles: sources.length, citations: cited.citations.length, evidenceStatus: verified.check.status }),
      citedArticles: sources.length,
      articlesReviewed: articleIds.length,
      corpusArticles: typeof corpusArticles === "number" ? corpusArticles : null,
      scope: scopeText || null,
    };
    log(grounded ? "answered" : "not-covered", {
      intent: analysis.intent,
      evidenceStatus: verified.check.status,
      articles: sources.length,
      citations: cited.citations.length,
      ...modelInfo,
      timedOut: incomplete,
    });

    return withQuota({
      mode: "answered",
      answer: verified.answer,
      grounded,
      incomplete,
      intent: analysis.intent,
      citations: cited.citations,
      sources,
      evidence: {
        ...verified.check,
        passagesReviewed: chunks.length,
        articlesReviewed: articleIds.length,
      },
      coverage,
      evidenceIds: chunks.map((c) => c.chunkId),
      suggestedQuestions,
      sectionQuestions,
      sectionArticle: primaryTitle ? shortTitle(primaryTitle) : null,
      sectionArticleId: focusedIds[0] ?? sources[0]?.id ?? null,
      model: result.model,
      answeredAt: new Date().toISOString(),
    });
  } catch (e) {
    if (signal.aborted) {
      log("stopped", { ...modelInfo });
      return { mode: "stopped" };
    }
    if (deadline.aborted) {
      log("timeout", { ...modelInfo });
      return withQuota({ mode: "unavailable", message: TIMEOUT_MESSAGE });
    }
    // e.g. a 401 from a provider, an exhausted credit balance, a rate limit
    // or a malformed reply. Logged in full here; the reader gets the same
    // friendly banner as every other non-answer path.
    console.error("[corpus-chat] chat failed:", e);
    log("unavailable");
    return withQuota({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
}
