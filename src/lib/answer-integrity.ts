/**
 * Citation integrity for the journal's AI Research Assistant.
 *
 * The model cites evidence inline as [P3] (passage 3) or [A1] (article
 * record 1). This module turns those markers into numbered citations the
 * reader can follow ([1], [2], ...), drops any marker that points at
 * evidence that wasn't supplied, and checks the answer against the source
 * text before it's shown:
 *
 * - DOIs must belong to a cited journal record, or they are removed.
 * - Quotations must appear word for word in the evidence, or the quote
 *   marks come off (the words stay, as a paraphrase).
 * - Page numbers must appear in the evidence (passages carry none), or
 *   they are removed.
 * - Figures (decimals, percentages, sample sizes) that can't be found in
 *   the evidence are listed as warnings for the reader.
 * - A reference list the model writes itself is removed: the platform
 *   builds the references from verified journal metadata.
 *
 * Pure functions, tested in answer-integrity.test.ts.
 */
import { parseAuthors } from "@/lib/article";

export interface EvidencePassage {
  chunkId: string;
  articleId: string;
  articleTitle: string;
  chunkIndex: number;
  text: string;
}

export interface EvidenceArticle {
  id: string;
  /** Prompt label, e.g. "A1". */
  label: string;
  title: string;
  authors: string;
  abstract: string;
  keywords: string;
  doi: string | null;
  publishedAt: Date | null;
  discipline: string;
  volume?: number | null;
  issueNumber?: number | null;
}

export interface AnswerCitation {
  /** The number shown inline, e.g. [2]. */
  n: number;
  kind: "passage" | "record";
  articleId: string;
  /** 1-based index of the article in `sources`. */
  sourceN: number;
  chunkId?: string;
  chunkIndex?: number;
  /** The supporting text: the passage, or the start of the abstract. */
  text: string;
  /** Link to the article, scrolled to the passage where browsers support it. */
  url: string;
}

export interface AnswerSource {
  n: number;
  id: string;
  title: string;
  authors: { name: string; affiliation?: string }[];
  year: number | null;
  publishedAt: string | null;
  doi: string | null;
  url: string;
  keywords: string[];
  abstract: string;
  discipline: string;
  /** APA 7 reference built from the journal record. */
  reference: string;
}

export interface EvidenceCheck {
  status: "verified" | "review" | "unsupported";
  /** Plain-language notes about anything the checks changed or couldn't confirm. */
  warnings: string[];
  unverifiedFigures: string[];
}

const MARKER = /\[((?:\s*(?:P(?:assage)?\s*\d+|A\s*\d+|\d+)\s*[,;]?\s*)+)\]/gi;
const ABSTRACT_EXCERPT = 420;

/** Removes a "References"/"Sources" section the model added itself. */
export function stripModelReferenceList(answer: string): string {
  return answer
    .replace(/\n+\s*(?:#{1,6}\s*|\*\*)?(?:references|reference list|sources|bibliography|works cited|citations)(?:\*\*)?:?(?:\*\*)?\s*\n[\s\S]*$/i, "")
    .trim();
}

function articleUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/article/${encodeURIComponent(id)}`;
}

/** A text-fragment link (#:~:text=) to the passage on the article page. */
export function passageUrl(baseUrl: string, articleId: string, text: string, chunkIndex: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  // A passage after the first can start mid-word (chunks overlap), and a
  // text fragment only matches whole words.
  const start = chunkIndex > 0 ? words.slice(1) : words;
  const phrase = start
    .slice(0, 8)
    .join(" ")
    .replace(/[^\p{L}\p{N}\s'’.,-]/gu, "")
    .trim();
  const base = articleUrl(baseUrl, articleId);
  return phrase.split(" ").length >= 4 ? `${base}#:~:text=${encodeURIComponent(phrase)}` : base;
}

/**
 * Replaces the model's [P3]/[A1] markers with numbered citations, in order
 * of first use. Markers that point at evidence that wasn't supplied are
 * removed. If the answer has no inline markers at all, the passages the
 * model listed in usedPassages become the citations.
 */
export function resolveCitations(
  answer: string,
  passages: EvidencePassage[],
  articles: EvidenceArticle[],
  usedPassages: number[],
  baseUrl: string
): { answer: string; citations: AnswerCitation[]; sources: AnswerSource[]; droppedMarkers: number } {
  const byLabel = new Map(articles.map((a) => [a.label.toUpperCase(), a]));
  const byId = new Map(articles.map((a) => [a.id, a]));
  const keyToN = new Map<string, number>();
  const citations: Omit<AnswerCitation, "sourceN">[] = [];
  let dropped = 0;

  const cite = (key: string, make: () => Omit<AnswerCitation, "n" | "sourceN"> | null): number | null => {
    const existing = keyToN.get(key);
    if (existing) return existing;
    const c = make();
    if (!c) return null;
    const n = citations.length + 1;
    keyToN.set(key, n);
    citations.push({ n, ...c });
    return n;
  };
  const citePassage = (i: number) =>
    cite(`p:${i}`, () => {
      const p = passages[i - 1];
      if (!p) return null;
      return {
        kind: "passage",
        articleId: p.articleId,
        chunkId: p.chunkId,
        chunkIndex: p.chunkIndex,
        text: p.text,
        url: passageUrl(baseUrl, p.articleId, p.text, p.chunkIndex),
      };
    });
  const citeRecord = (label: string) =>
    cite(`a:${label}`, () => {
      const a = byLabel.get(label);
      if (!a) return null;
      const abstract = a.abstract?.trim() || a.title;
      return {
        kind: "record",
        articleId: a.id,
        text: abstract.length > ABSTRACT_EXCERPT ? `${abstract.slice(0, ABSTRACT_EXCERPT)}…` : abstract,
        url: articleUrl(baseUrl, a.id),
      };
    });

  let out = answer.replace(MARKER, (_m, inner: string) => {
    const ns: number[] = [];
    for (const raw of inner.split(/[,;]/)) {
      const item = raw.trim().toUpperCase().replace(/\s+/g, "");
      if (!item) continue;
      let n: number | null = null;
      if (item.startsWith("A")) n = citeRecord(item);
      else n = citePassage(Number(item.replace(/^P(ASSAGE)?/, "")));
      if (n === null) dropped++;
      else if (!ns.includes(n)) ns.push(n);
    }
    return ns
      .sort((a, b) => a - b)
      .map((n) => `[${n}]`)
      .join("");
  });
  // Adjacent groups ("[3][1]") read in ascending order.
  out = out.replace(/(?:\[\d+\])+/g, (run) => {
    const ns = [...new Set((run.match(/\d+/g) ?? []).map(Number))].sort((a, b) => a - b);
    return ns.map((n) => `[${n}]`).join("");
  });
  // Tidy spaces left where an invalid marker was removed.
  out = out.replace(/[ \t]+([.,;:!?)])/g, "$1").replace(/[ \t]{2,}/g, " ");

  if (citations.length === 0) {
    for (const i of usedPassages) citePassage(i);
  }

  // Sources: the cited articles, in order of first citation.
  const sourceOrder: string[] = [];
  for (const c of citations) if (!sourceOrder.includes(c.articleId)) sourceOrder.push(c.articleId);
  const sources: AnswerSource[] = [];
  for (const id of sourceOrder) {
    const a = byId.get(id);
    if (a) sources.push(toSource(a, sources.length + 1, baseUrl));
    else {
      // A passage whose article record failed to load: still a real source.
      const p = passages.find((x) => x.articleId === id);
      sources.push({
        n: sources.length + 1,
        id,
        title: p?.articleTitle ?? "Untitled article",
        authors: [],
        year: null,
        publishedAt: null,
        doi: null,
        url: articleUrl(baseUrl, id),
        keywords: [],
        abstract: "",
        discipline: "",
        reference: `${p?.articleTitle ?? "Untitled article"}. ${articleUrl(baseUrl, id)}`,
      });
    }
  }
  const sourceN = new Map(sources.map((s) => [s.id, s.n]));
  return {
    answer: out.trim(),
    citations: citations.map((c) => ({ ...c, sourceN: sourceN.get(c.articleId) ?? 0 })),
    sources,
    droppedMarkers: dropped,
  };
}

/** A source entry built from a journal record (reference left for the caller). */
export function toSource(a: EvidenceArticle, n: number, baseUrl: string): AnswerSource {
  const authors = parseAuthors(a.authors)
    .filter((x) => x?.name)
    .map((x) => ({ name: x.name, ...(x.affiliation ? { affiliation: x.affiliation } : {}) }));
  const year = a.publishedAt ? a.publishedAt.getUTCFullYear() : null;
  const abstract = (a.abstract ?? "").trim();
  return {
    n,
    id: a.id,
    title: a.title,
    authors,
    year,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : null,
    doi: a.doi || null,
    url: articleUrl(baseUrl, a.id),
    keywords: (a.keywords ?? "")
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 8),
    abstract: abstract.length > 900 ? `${abstract.slice(0, 900)}…` : abstract,
    discipline: a.discipline ?? "",
    reference: "",
  };
}

/** "Ana María Rivera" → "Rivera, A. M." */
function apaAuthor(name: string): string {
  const parts = name
    .replace(/^(Dr|Prof|Professor|Mr|Mrs|Ms)\.?\s+/i, "")
    .replace(/,.*$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(" ");
  return `${last}, ${initials}`;
}

/** APA 7 reference from verified journal metadata only. */
export function apaReference(
  s: Pick<AnswerSource, "authors" | "year" | "title" | "doi" | "url">,
  journal: { name: string; volume?: number | null; issueNumber?: number | null }
): string {
  const names = s.authors.map((a) => apaAuthor(a.name)).filter(Boolean);
  let authorPart = "";
  if (names.length === 1) authorPart = names[0];
  else if (names.length === 2) authorPart = `${names[0]}, & ${names[1]}`;
  else if (names.length > 2 && names.length <= 20) authorPart = `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  else if (names.length > 20) authorPart = `${names.slice(0, 19).join(", ")}, … ${names[names.length - 1]}`;
  const year = s.year ? `(${s.year})` : "(n.d.)";
  const title = s.title.trim().replace(/[.]+$/, "");
  const volume = journal.volume ? `, ${journal.volume}${journal.issueNumber ? `(${journal.issueNumber})` : ""}` : "";
  const link = s.doi ? `https://doi.org/${s.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : s.url;
  return `${authorPart ? `${authorPart} ` : ""}${year}. ${title}. ${journal.name}${volume}. ${link}`;
}

/** Lowercase, punctuation-free, single-spaced text for containment checks. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}%.' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks an answer's specifics against the evidence it was given and
 * repairs what can be repaired safely. `evidenceTexts` are the passages
 * and article records the model saw; `knownDois` the DOIs in those records.
 */
export function verifyAnswer(
  answer: string,
  evidenceTexts: string[],
  knownDois: string[],
  grounded: boolean,
  citationCount: number
): { answer: string; check: EvidenceCheck } {
  const warnings: string[] = [];
  const corpus = evidenceTexts.join("\n");
  const corpusNorm = norm(corpus);
  const compact = corpus.replace(/\s+/g, "").toLowerCase();
  let out = answer;

  // DOIs.
  const allowed = new Set(knownDois.filter(Boolean).map((d) => d.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "")));
  let removedDois = 0;
  out = out.replace(/(?:https?:\/\/(?:dx\.)?doi\.org\/)?\b(10\.\d{4,9}\/[^\s"'<>\])]+)/gi, (m, doi: string) => {
    const clean = doi.replace(/[.,;:]+$/, "");
    if (allowed.has(clean.toLowerCase())) return m;
    removedDois++;
    return "[DOI not in the journal record]";
  });
  if (removedDois) warnings.push(`Removed ${removedDois === 1 ? "a DOI" : `${removedDois} DOIs`} not found in the journal's records.`);

  // Quotations.
  let unquoted = 0;
  // An opening quote follows a space, line start or bracket and a closing
  // quote isn't followed by a letter, so the gap between two quoted titles
  // ("A" and "B") is never mistaken for a quotation.
  out = out.replace(/(^|[\s(\[—–-])(["“])(?=\S)([^"“”\n]{25,500}?)(["”])(?![\p{L}\p{N}])/gmu, (m, lead: string, _o, inner: string) => {
    const n = norm(inner);
    if (!n || corpusNorm.includes(n)) return m;
    unquoted++;
    return `${lead}${inner}`;
  });
  if (unquoted) {
    warnings.push(
      `${unquoted === 1 ? "A quotation" : `${unquoted} quotations`} could not be matched word for word to the source text, so ${unquoted === 1 ? "it is" : "they are"} shown as paraphrase.`
    );
  }

  // Page numbers (passages carry none unless the text itself has them).
  let removedPages = 0;
  out = out.replace(/\s*\(?\b(?:pp?\.\s*\d+(?:\s*[–-]\s*\d+)?|pages?\s+\d+(?:\s*[–-]\s*\d+)?)\)?/gi, (m) => {
    const ref = m.replace(/[()\s]/g, "").toLowerCase();
    if (compact.includes(ref)) return m;
    removedPages++;
    return "";
  });
  if (removedPages) warnings.push("Removed page numbers that the journal's records don't support.");

  // Figures: decimals, percentages and sample sizes must appear in the evidence.
  const unverifiedFigures: string[] = [];
  const figure = /(?<![\w.\[])(?:n\s*=\s*\d[\d,]*|\d+(?:\.\d+)?\s?%|\d*\.\d+)(?![\w\]])/gi;
  for (const m of out.matchAll(figure)) {
    const raw = m[0];
    const value = raw.replace(/\s/g, "").toLowerCase();
    const variants = new Set<string>([value]);
    if (value.startsWith("n=")) variants.add(value.slice(2));
    if (value.startsWith("0.")) variants.add(value.slice(1));
    if (value.startsWith(".")) variants.add(`0${value}`);
    if (value.endsWith("%")) {
      variants.add(`${value.slice(0, -1)}percent`);
      variants.add(`${value.slice(0, -1)}per cent`.replace(/\s/g, ""));
    }
    const found = [...variants].some((v) => compact.includes(v));
    if (!found && !unverifiedFigures.includes(raw.trim())) unverifiedFigures.push(raw.trim());
  }
  if (unverifiedFigures.length) {
    warnings.push(
      `${unverifiedFigures.length === 1 ? "One figure" : `${unverifiedFigures.length} figures`} (${unverifiedFigures
        .slice(0, 4)
        .join(", ")}) could not be matched to the source text. Check ${unverifiedFigures.length === 1 ? "it" : "them"} against the article.`
    );
  }

  if (grounded && citationCount === 0) {
    warnings.push("This answer has no citations to the journal's records, so treat it with caution.");
  }

  const status: EvidenceCheck["status"] = !grounded ? "unsupported" : warnings.length ? "review" : "verified";
  return { answer: out.replace(/[ \t]{2,}/g, " ").trim(), check: { status, warnings, unverifiedFigures } };
}
