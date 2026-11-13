import { NextRequest, NextResponse } from "next/server";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";
import { loadCorpusChunksByIds, retrieveChunksAcrossCorpus, type CorpusRetrievedChunk } from "@/lib/chunk-embeddings";
import { db } from "@/lib/db";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
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
import { ARTICLE_RECORD_SELECT, formatArticleRecord, formatHistory, normalizeUsedPassages } from "@/lib/rag-prompt";
import { analyzeQuestion, cleanSourceIds, resolveContextArticles, retrievalPlan, type ContextTurn, type QuestionIntent } from "@/lib/research-query";
import {
  apaReference,
  resolveCitations,
  stripModelReferenceList,
  verifyAnswer,
  type EvidenceArticle,
} from "@/lib/answer-integrity";
import { loadJournalInfo } from "@/lib/research-assistant";

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
 * Public, no login required (the content is open access), rate-limited
 * per IP.
 */
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 800;

/** What readers see whenever no answer can be produced for an operational
 * reason (no provider configured, a provider outage, a rejected or expired
 * API key, a retrieval error). The real cause is logged server-side only. */
const UNAVAILABLE_MESSAGE =
  "The Research Assistant is temporarily unavailable. Please try again in a few minutes, or browse and search the published articles directly.";
const MAX_HISTORY_TURNS = 6;
/** Ask the model again once if the first reply fails (the free router can
 * pick a model that returns a malformed reply), as long as there's time
 * left within maxDuration. */
const RETRY_IF_FAILED_WITHIN_MS = 25_000;
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
async function loadArticleRecords(ids: string[]): Promise<RecordRow[]> {
  if (ids.length === 0) return [];
  try {
    const rows = (await db.article.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
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
    "- If the records only partly answer the question, answer that part and say plainly what they don't establish (\"The journal's records don't state …\"). If they don't answer it at all, say so and set grounded to false.",
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
    "",
    "Conversation: earlier turns are only for understanding references such as \"this article\", \"the previous study\", \"those findings\", \"the second methodology\" or \"the same author\" (see RESOLVED REFERENCES when present). Never treat an earlier answer as evidence: verify every claim against the records in this message.",
    "",
    `Also give "suggestedQuestions": up to ${MAX_SUGGESTIONS} short, specific follow-up questions about the article(s) your answer is about, each on a different part of the paper (${SECTION_NAMES.join(", ")}) or a comparison with another article in the records, naming the article by a short form of its title, using its actual content (topic, variables, setting, instruments, findings) rather than generic wording, and answerable from these records. Do not repeat the reader's question.`,
    "",
    'Reply with only a JSON object: {"answer": string (Markdown), "usedPassages": number[] (every passage you drew on), "grounded": boolean (false only when the records do not answer the question), "suggestedQuestions": string[]}.',
  ].join("\n");

/**
 * GET /api/corpus-chat — the assistant's masthead (journal name, ISSN,
 * publisher, number of published articles) and ready-made research
 * prompts about the journal's newest articles for the empty chat.
 */
export async function GET(req?: NextRequest) {
  const tenant = req ? await resolveTenantFromHeaders(req.headers).catch(() => null) : null;
  const tenantId = tenant && !tenant.isPlatform ? tenant.id : null;
  try {
    const [recent, articleCount, journal] = await Promise.all([
      db.article.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 4,
        select: { title: true },
      }),
      db.article.count({ where: { status: "PUBLISHED" } }).catch(() => null),
      loadJournalInfo(tenantId),
    ]);
    const prompts = starterPrompts(recent.map((a) => a.title));
    return NextResponse.json(
      {
        suggestedQuestions: prompts.filter((p) => p.category === "Explore a paper").map((p) => p.question).slice(0, MAX_SUGGESTIONS),
        prompts,
        journal,
        stats: { articles: articleCount },
      },
      { headers: { "Cache-Control": req ? tenantCacheControl(req, tenant, "public, s-maxage=300, stale-while-revalidate=3600") : "public, s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (e) {
    console.error("[corpus-chat] starter questions failed:", e);
    return NextResponse.json({ suggestedQuestions: [], prompts: [], journal: await loadJournalInfo(tenantId), stats: { articles: null } });
  }
}

export async function POST(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`corpus-chat:${ip}`, 8, 300);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  let body: { question?: string; history?: unknown; evidenceIds?: unknown; regenerate?: boolean };
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

  if (!anyLLMAvailable()) {
    console.warn("[corpus-chat] no LLM provider configured (set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or LLM_BASE_URL/LLM_API_KEY)");
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }

  const history = cleanHistory(body.history);
  const historyBlock = formatHistory(history);
  const analysis = analyzeQuestion(question);
  const plan = retrievalPlan(analysis);
  const contextIds = resolveContextArticles(analysis, history);
  const regenerate = body.regenerate === true;
  const evidenceIds = cleanSourceIds(body.evidenceIds, MAX_EVIDENCE_IDS);

  let chunks: CorpusRetrievedChunk[] = [];
  try {
    // "Regenerate": the same evidence as the earlier answer.
    if (regenerate && evidenceIds.length > 0) chunks = await loadCorpusChunksByIds(evidenceIds);
    if (chunks.length === 0) {
      // A follow-up that refers back ("what were its limitations?") is also
      // retrieved with the reader's previous question, and "the same
      // author" with the authors' names.
      const previousQuestion = analysis.refersToContext
        ? [...history].reverse().find((t) => t.role === "user")?.content ?? ""
        : "";
      let authorNames = "";
      if (analysis.sameAuthor && contextIds.length) {
        const ctx = await loadArticleRecords(contextIds.slice(0, 1));
        authorNames = ctx.flatMap((r) => parseAuthors(r.authors).map((a) => a?.name ?? "")).join(" ");
      }
      const retrievalQuery = [question, previousQuestion.slice(0, MAX_QUESTION_LENGTH), sectionRetrievalHints(question), authorNames]
        .filter((part) => part.trim())
        .join("\n");
      chunks = await retrieveChunksAcrossCorpus(retrievalQuery, plan.limit, {
        contextArticleIds: contextIds,
        maxFocused: plan.maxFocused,
        maxPerArticle: plan.maxPerArticle,
      });
    }
  } catch (e) {
    console.error("[corpus-chat] retrieval failed:", e);
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
  if (chunks.length === 0) {
    return NextResponse.json({
      mode: "not-indexed",
      message: "No published articles are indexed for the Research Assistant yet.",
    });
  }

  // One label per source article (A1, A2, ...), shared by the records and
  // the passages so the model can tie them together.
  const articleIds = [...new Set(chunks.map((c) => c.articleId))];
  const labelOf = new Map(articleIds.map((id, i) => [id, `A${i + 1}`]));
  const [records, journal] = await Promise.all([loadArticleRecords(articleIds), loadJournalInfo(await journalTenantId(req))]);
  const focusedIds = [...new Set(chunks.filter((c) => c.focused).map((c) => c.articleId))];
  const focusedTitles = focusedIds.map((id) => chunks.find((c) => c.articleId === id)!.articleTitle);

  const recordsBlock = records.length
    ? `ARTICLE RECORDS (bibliographic details of each source article):\n\n${records
        .map((a) => formatArticleRecord(a, labelOf.get(a.id)))
        .join("\n\n")}`
    : "";
  const passageBlock = `PASSAGES (excerpts from the articles' full text):\n\n${chunks
    .map((c, i) => `[P${i + 1} | ${labelOf.get(c.articleId)} "${c.articleTitle}"]\n${c.text}`)
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
  const regenerateNote = regenerate
    ? "\n\nThis is a regenerated answer: write a fresh response from the same evidence, organised and worded independently of any earlier answer."
    : "";

  const systemPrompt = SYSTEM_PROMPT(journal.name);
  const userPrompt = `${recordsBlock}\n\n${passageBlock}${historyBlock}${resolvedBlock}${focusNote}\n\n${INTENT_NOTES[analysis.intent]}${regenerateNote}\n\nReader's question: ${question}`;

  try {
    const ask = () =>
      chatJSON<{ answer: string; usedPassages?: number[]; grounded?: boolean; suggestedQuestions?: unknown }>(systemPrompt, userPrompt, {
        maxTokens: analysis.intent === "comparison" ? 2600 : 2000,
        priority: "cost-first",
        temperature: regenerate ? 0.5 : 0.1,
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
    let usedPassages = normalizeUsedPassages(result.data.usedPassages);
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
      stripModelReferenceList(result.data.answer),
      chunks.map((c) => ({ chunkId: c.chunkId, articleId: c.articleId, articleTitle: c.articleTitle, chunkIndex: c.chunkIndex, text: c.text })),
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
    if (cited.droppedMarkers > 0) {
      verified.check.warnings.unshift(
        `Removed ${cited.droppedMarkers === 1 ? "a citation" : `${cited.droppedMarkers} citations`} that pointed at evidence the assistant wasn't given.`
      );
      if (verified.check.status === "verified") verified.check.status = "review";
    }

    console.info(
      `[corpus-chat] answered by ${result.provider}/${result.model}; intent=${analysis.intent}, context=${contextIds.length}, ${chunks.length} passages, ${cited.citations.length} citations, evidence=${verified.check.status}`
    );

    // Follow-up questions about the paper the answer is about: the article
    // the reader named or referred to, otherwise the first cited source.
    const primaryTitle = focusedTitles[0] ?? sources[0]?.title ?? chunks[0]?.articleTitle ?? null;
    const asked = [question, ...history.filter((t) => t.role === "user").map((t) => t.content)];
    const sectionQuestions = primaryTitle ? remainingSectionQuestions(primaryTitle, asked) : [];
    const suggestedQuestions = finalizeSuggestions(result.data.suggestedQuestions, asked, sectionQuestions);

    return NextResponse.json({
      mode: "answered",
      answer: verified.answer,
      grounded,
      intent: analysis.intent,
      citations: cited.citations,
      sources,
      evidence: {
        ...verified.check,
        passagesReviewed: chunks.length,
        articlesReviewed: articleIds.length,
      },
      evidenceIds: chunks.map((c) => c.chunkId),
      suggestedQuestions,
      sectionQuestions,
      sectionArticle: primaryTitle ? shortTitle(primaryTitle) : null,
      sectionArticleId: focusedIds[0] ?? sources[0]?.id ?? null,
      model: result.model,
      answeredAt: new Date().toISOString(),
    });
  } catch (e) {
    // e.g. a 401 from a provider, an exhausted credit balance, a rate limit
    // or a malformed reply. Logged in full here; the reader gets the same
    // friendly banner as every other non-answer path.
    console.error("[corpus-chat] chat failed:", e);
    return NextResponse.json({ mode: "unavailable", message: UNAVAILABLE_MESSAGE });
  }
}

/** The whitelabel tenant this request belongs to (null for the platform). */
async function journalTenantId(req: NextRequest): Promise<string | null> {
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  return tenant && !tenant.isPlatform ? tenant.id : null;
}
