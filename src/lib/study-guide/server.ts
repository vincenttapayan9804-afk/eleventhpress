/**
 * Builds, stores and serves each published article's Researcher's Study
 * Guide (HTML), so every article — on the platform and on every tenant —
 * has one ready to download without anyone having to request it first.
 *
 * - Publishing an article builds its guide straight away (the extractive
 *   guide takes milliseconds) and then asks the background builder to
 *   replace it with the LLM-written version.
 * - The daily sweep builds a guide for every published article that has
 *   none (existing articles included) and upgrades extractive ones once an
 *   LLM is reachable.
 * - The download route serves the stored file. If there is none yet (or
 *   the article, its references or its publisher branding changed), it
 *   builds the extractive guide on the spot, serves it, stores it and
 *   queues the upgrade — so a download never waits on the LLM.
 *
 * Stored at study-guides/<articleId>/<hash>.html with a .json sidecar; the
 * hash covers everything the page shows, so any edit produces a new file.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getObject, putObject } from "@/lib/storage";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { logoPngOf, publisherIdentityForJournal, JOURNAL_SELECT, type PublisherIdentity } from "@/lib/publisher-identity";
import { poweredByFor } from "@/lib/powered-by";
import { APP_BASE_URL } from "@/lib/site";
import { anyLLMAvailable } from "@/lib/llm";
import { parseAuthors } from "@/lib/article";
import { displayCase, getResearchVisualContent, peekResearchVisualContent, type ResearchSource } from "@/lib/research-visuals";
import { buildExtractiveGuide, getStudyGuide, STUDY_GUIDE_VERSION, type StudyGuideData, type StudyGuideSource } from "@/lib/study-guide/build";
import { STUDY_GUIDE_TEMPLATE } from "@/lib/study-guide/template.generated";
import { renderStudyGuideHtml, studyGuideFileName, type StudyGuideMeta } from "@/lib/study-guide/render";

const ARTICLE_SELECT = {
  id: true,
  status: true,
  title: true,
  abstract: true,
  authors: true,
  doi: true,
  keywords: true,
  discipline: true,
  contentType: true,
  laySummary: true,
  publishedAt: true,
  galleyHtmlKey: true,
  journal: { select: JOURNAL_SELECT },
} as const;

type ArticleRow = {
  id: string;
  status: string;
  title: string;
  abstract: string;
  authors: string;
  doi: string | null;
  keywords: string;
  discipline: string;
  contentType: string;
  laySummary: string | null;
  publishedAt: Date | null;
  galleyHtmlKey: string | null;
  journal: Parameters<typeof publisherIdentityForJournal>[0];
};

interface Loaded {
  article: ArticleRow;
  identity: PublisherIdentity;
  bodyHtml: string | null;
  references: string[];
  /** Hash of everything the guide shows; names the stored file. */
  hash: string;
}

function bodyFromGalley(html: string): string | null {
  return html.match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/)?.[1] ?? null;
}

async function load(article: ArticleRow | null): Promise<Loaded | null> {
  if (!article || article.status !== "PUBLISHED") return null;
  const [galley, refs, identity] = await Promise.all([
    article.galleyHtmlKey ? getObject(article.galleyHtmlKey).catch(() => null) : Promise.resolve(null),
    db.reference.findMany({ where: { articleId: article.id }, select: { rawText: true }, orderBy: { createdAt: "asc" } }).catch(() => []),
    publisherIdentityForJournal(article.journal),
  ]);
  const bodyHtml = galley ? bodyFromGalley(galley.toString("utf-8")) : null;
  const references = refs.map((r) => r.rawText.replace(/\s+/g, " ").trim()).filter(Boolean);
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        // A new guide version or template rebuilds every stored guide.
        STUDY_GUIDE_VERSION, STUDY_GUIDE_TEMPLATE.length,
        article.title, article.abstract, article.authors, article.doi, article.keywords, article.discipline, article.contentType,
        article.publishedAt?.toISOString() ?? "", bodyHtml ?? "", references,
        identity.publisher, identity.journalName, identity.logoUrl, identity.whitelabel,
      ])
    )
    .digest("hex")
    .slice(0, 24);
  return { article, identity, bodyHtml, references, hash };
}

function researchSource(l: Loaded): ResearchSource {
  const a = l.article;
  return { id: a.id, title: a.title.replace(/\s+/g, " ").trim(), abstract: a.abstract, keywords: a.keywords, discipline: a.discipline, laySummary: a.laySummary, bodyHtml: l.bodyHtml };
}

function guideSource(l: Loaded, content: StudyGuideSource["content"]): StudyGuideSource {
  const a = l.article;
  return {
    id: a.id,
    title: a.title.replace(/\s+/g, " ").trim(),
    abstract: a.abstract,
    keywords: a.keywords,
    discipline: a.discipline,
    authors: parseAuthors(a.authors).map((x) => ({ name: x.name, affiliation: x.affiliation })),
    bodyHtml: l.bodyHtml,
    references: l.references,
    content,
  };
}

async function metaFor(l: Loaded, shortTitle: string): Promise<StudyGuideMeta> {
  const a = l.article;
  const authors = parseAuthors(a.authors);
  const png = await logoPngOf(l.identity.logoUrl, 160).catch(() => null);
  const title = displayCase(a.title.replace(/\s+/g, " ").trim());
  return {
    articleId: a.id,
    title,
    shortTitle: displayCase(shortTitle || title),
    authors: authors.map((x) => displayCase(x.name)),
    affiliations: authors.map((x) => x.affiliation),
    journalName: l.identity.journalName,
    publisher: l.identity.publisher,
    publishedAt: a.publishedAt,
    doi: a.doi,
    articleUrl: `${APP_BASE_URL}/article/${a.id}`,
    contentType: a.contentType,
    logoDataUri: png ? `data:image/png;base64,${png.toString("base64")}` : null,
    whitelabel: l.identity.whitelabel,
    poweredBy: poweredByFor(l.identity),
  };
}

interface Stored {
  mode: StudyGuideData["mode"];
  generatedAt: string;
  fileName: string;
}

const htmlKey = (id: string, hash: string) => `study-guides/${id}/${hash}.html`;
const metaKey = (id: string, hash: string) => `study-guides/${id}/${hash}.json`;

async function readStored(id: string, hash: string): Promise<Stored | null> {
  const buf = await getObject(metaKey(id, hash)).catch(() => null);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf-8")) as Stored;
  } catch {
    return null;
  }
}

async function store(l: Loaded, guide: StudyGuideData, html: string, fileName: string) {
  const s: Stored = { mode: guide.mode, generatedAt: guide.generatedAt, fileName };
  await putObject(htmlKey(l.article.id, l.hash), Buffer.from(html, "utf-8"), "text/html; charset=utf-8");
  await putObject(metaKey(l.article.id, l.hash), Buffer.from(JSON.stringify(s), "utf-8"), "application/json");
}

/** Builds (instantly, without an LLM) and stores the guide. */
async function buildQuick(l: Loaded): Promise<{ html: string; fileName: string }> {
  const content = await peekResearchVisualContent(researchSource(l));
  const guide = buildExtractiveGuide(guideSource(l, content));
  const meta = await metaFor(l, content.shortTitle);
  const html = renderStudyGuideHtml(guide, meta);
  const fileName = studyGuideFileName(meta);
  await store(l, guide, html, fileName).catch((e) => console.error(`[study-guide] store failed for ${l.article.id}`, e));
  return { html, fileName };
}

/** Builds the full (LLM-written, when available) guide and stores it. */
async function buildFull(l: Loaded): Promise<StudyGuideData["mode"]> {
  const content = await getResearchVisualContent(researchSource(l));
  const guide = await getStudyGuide(guideSource(l, content));
  const meta = await metaFor(l, content.shortTitle);
  await store(l, guide, renderStudyGuideHtml(guide, meta), studyGuideFileName(meta));
  return guide.mode;
}

async function loadById(articleId: string): Promise<Loaded | null> {
  const article = (await db.article.findUnique({ where: { id: articleId }, select: ARTICLE_SELECT }).catch(() => null)) as ArticleRow | null;
  return load(article);
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Makes sure the article has a stored guide: builds the instant one when
 * none exists, then (when `full` and an LLM is configured) the LLM version.
 */
export async function ensureStudyGuide(articleId: string, opts: { full: boolean }): Promise<"missing" | "extractive" | "llm"> {
  const l = await loadById(articleId);
  if (!l) return "missing";
  const stored = await readStored(articleId, l.hash);
  if (!stored) await buildQuick(l);
  if (stored?.mode === "llm") return "llm";
  if (!opts.full || !anyLLMAvailable()) return "extractive";
  // One upgrade at a time per article version (downloads and the sweep may both ask).
  const lockKey = `study-guides/${articleId}/${l.hash}.lock`;
  const lock = await getObject(lockKey).catch(() => null);
  if (lock && Date.now() - Number(lock.toString("utf-8")) < LOCK_MS) return "extractive";
  await putObject(lockKey, Buffer.from(String(Date.now()), "utf-8"), "text/plain").catch(() => {});
  return buildFull(l);
}

const LOCK_MS = 10 * 60 * 1000;

/**
 * Asks the background builder (/api/cron/study-guides, which has a long
 * time limit) to produce the LLM-written guide, without waiting for it.
 */
export async function requestStudyGuideUpgrade(articleId: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !anyLLMAvailable()) return;
  try {
    await fetch(`${APP_BASE_URL}/api/cron/study-guides?article=${encodeURIComponent(articleId)}`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // The request keeps running server-side after this client gives up; the
    // daily sweep is the backstop if it did not start.
  }
}

export interface ServedGuide {
  html: string;
  fileName: string;
  /** True when this is the instant (extractive) version and an upgrade is due. */
  needsUpgrade: boolean;
}

/** The stored guide for a published article visible to this request's tenant. */
export async function serveStudyGuide(articleId: string, headers: Headers): Promise<ServedGuide | null> {
  const tenant = await resolveTenantFromHeaders(headers);
  const article = (await withTenantRlsContext(tenant?.id ?? null, (tx) => tx.article.findUnique({ where: { id: articleId }, select: ARTICLE_SELECT }))) as ArticleRow | null;
  const l = await load(article);
  if (!l) return null;
  const stored = await readStored(articleId, l.hash);
  if (stored) {
    const html = await getObject(htmlKey(articleId, l.hash)).catch(() => null);
    if (html) return { html: html.toString("utf-8"), fileName: stored.fileName, needsUpgrade: stored.mode !== "llm" && anyLLMAvailable() };
  }
  const built = await buildQuick(l);
  return { ...built, needsUpgrade: anyLLMAvailable() };
}

/**
 * Daily sweep: every published article gets a stored guide (instant build),
 * then up to `maxUpgrades` extractive guides are handed to the background
 * builder, one request each, so each gets its own time limit.
 */
export async function sweepStudyGuides(budgetMs = 200_000, maxUpgrades = 8): Promise<{ articles: number; built: number; upgradesRequested: number; awaitingUpgrade: number; failed: number }> {
  const deadline = Date.now() + budgetMs;
  const ids = (await db.article.findMany({ where: { status: "PUBLISHED" }, select: { id: true }, orderBy: { publishedAt: "desc" } })).map((a) => a.id);
  let built = 0;
  let failed = 0;
  const toUpgrade: string[] = [];
  for (const id of ids) {
    if (Date.now() > deadline) break;
    try {
      const l = await loadById(id);
      if (!l) continue;
      const stored = await readStored(id, l.hash);
      if (!stored) {
        await buildQuick(l);
        built++;
      }
      if (stored?.mode !== "llm") toUpgrade.push(id);
    } catch (e) {
      failed++;
      console.error(`[study-guide] sweep build failed for ${id}`, e);
    }
  }
  let upgradesRequested = 0;
  if (anyLLMAvailable()) {
    for (const id of toUpgrade.slice(0, maxUpgrades)) {
      await requestStudyGuideUpgrade(id);
      upgradesRequested++;
    }
  }
  return { articles: ids.length, built, upgradesRequested, awaitingUpgrade: anyLLMAvailable() ? toUpgrade.length : 0, failed };
}
