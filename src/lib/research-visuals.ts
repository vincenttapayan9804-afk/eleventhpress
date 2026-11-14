/**
 * The content behind an article's research visuals: the downloadable
 * research infographic and conference poster (Galleys) and the graphical
 * abstract and theoretical framework / conceptual paradigm (Supplemental
 * tab). See src/lib/research-visuals-pdf.ts for the renderers.
 *
 * Everything shown on those documents comes from the article itself:
 *
 * - An LLM reads the title, abstract and full published body and returns a
 *   structured summary (aim, methods, key numbers, findings, conclusion,
 *   implications) plus the framework the study actually uses (its named
 *   theories, constructs/variables or Input-Process-Output paradigm, and
 *   the relationships between them).
 * - The answer is then checked against the source text: a key number whose
 *   value does not appear verbatim in the article, or a construct/theory the
 *   article never names, is dropped rather than printed.
 * - Without an LLM, an extractive fallback reads the abstract's own
 *   headings/sentences and pulls real figures out of it by pattern. It never
 *   invents a framework: if the article names no theory, that panel says so.
 * - The article's own figures (images with "Figure N" captions) are carried
 *   along, so a framework figure is reproduced exactly as published.
 *
 * Results are cached in object storage keyed by a hash of the article text,
 * so each article is analysed once and re-analysed only when its text
 * changes. Applies to every published article, past and future: the first
 * request generates it; publishing also warms it.
 */
import { createHash } from "node:crypto";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";
import { getObject, putObject } from "@/lib/storage";

export const RESEARCH_VISUALS_VERSION = 2;

export type ConstructRole =
  | "independent"
  | "mediator"
  | "moderator"
  | "dependent"
  | "control"
  | "input"
  | "process"
  | "output"
  | "theory"
  | "concept";

export type FrameworkLayout = "variables" | "ipo" | "theory" | "none";

export interface FrameworkConstruct {
  id: string;
  label: string;
  role: ConstructRole;
  /** Indicators / sub-dimensions as the article lists them. */
  items: string[];
}

export interface FrameworkRelationship {
  from: string;
  to: string;
  /** Hypothesis label ("H1") or a short verb ("predicts"), may be "". */
  label: string;
}

export interface ResearchFramework {
  layout: FrameworkLayout;
  /** "Conceptual Framework", "Theoretical Framework", "Conceptual Paradigm", … */
  title: string;
  theories: { name: string; note: string }[];
  constructs: FrameworkConstruct[];
  relationships: FrameworkRelationship[];
  /** One or two sentences explaining the framework, from the article. */
  narrative: string;
}

export interface ResearchVisualContent {
  version: number;
  mode: "llm" | "extractive";
  model: string;
  generatedAt: string;
  /**
   * "results" when the article reports findings; "proposal" when it only
   * describes the planned study (e.g. a thesis outline, Chapters 1–3) — such
   * documents show hypotheses and expected contribution, never findings.
   */
  stage: "results" | "proposal";
  /** Short title for tight layouts (graphical abstract), ≤ 12 words. */
  shortTitle: string;
  background: string;
  objective: string;
  researchQuestions: string[];
  /** Hypotheses as the article states them. */
  hypotheses: string[];
  methods: {
    design: string;
    participants: string;
    setting: string;
    instruments: string;
    analysis: string;
  };
  keyNumbers: { value: string; label: string }[];
  findings: string[];
  conclusion: string;
  implications: string[];
  limitations: string[];
  /** The study's stated significance / expected contribution. */
  significance: string;
  framework: ResearchFramework;
}

export interface ResearchSource {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  discipline: string;
  laySummary?: string | null;
  /** The published HTML galley's article-body markup, when available. */
  bodyHtml?: string | null;
}

export interface ArticleFigure {
  number: string;
  caption: string;
  src: string;
  /** Caption names a framework, paradigm, model or theory. */
  isFramework: boolean;
}

// ─── Text helpers ──────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&ndash;": "–", "&mdash;": "—", "&hellip;": "…", "&rsquo;": "’", "&lsquo;": "‘", "&rdquo;": "”", "&ldquo;": "“",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash|hellip|rsquo|lsquo|rdquo|ldquo);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Body HTML → plain text, keeping headings as "## Heading" lines. */
export function bodyHtmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, h) => `\n\n## ${h.replace(/<[^>]+>/g, "").trim()}\n`)
      .replace(/<\/(p|li|tr|figcaption|blockquote|table|div)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function squash(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ");
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "their", "of", "on", "in", "to", "a", "an", "as",
  "by", "or", "its", "is", "are", "be", "among", "between", "level", "levels", "students", "study",
]);

/** True when most of a phrase's meaningful words occur in the source. */
export function groundedIn(phrase: string, sourceNorm: string, threshold = 0.6): boolean {
  const words = norm(phrase)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  if (words.length === 0) return false;
  const hits = words.filter((w) => sourceNorm.includes(w.length > 5 ? w.slice(0, w.length - 2) : w)).length;
  return hits / words.length >= threshold;
}

/** True when a numeric value (e.g. "68.4%", "n = 312") appears in the source. */
export function numberGroundedIn(value: string, sourceNorm: string): boolean {
  const v = norm(value).replace(/\s+/g, "");
  if (!/\d/.test(v)) return false;
  const compactSource = sourceNorm.replace(/\s+/g, "");
  if (compactSource.includes(v)) return true;
  // Fall back to the bare number(s): every numeric token must appear.
  const nums = v.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return nums.length > 0 && nums.every((n) => compactSource.includes(n));
}

function sentences(text: string): string[] {
  return squash(text)
    .replace(/\b(e\.g|i\.e|et al|vs|cf|approx|Fig|No|Dr|Prof)\./gi, (m) => m.replace(".", "\u0000"))
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter((s) => s.length > 12);
}

function clip(s: string, max: number): string {
  const t = squash(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (at > max * 0.55) return cut.slice(0, at + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

// ─── Figures ───────────────────────────────────────────────────────────────

const FRAMEWORK_CAPTION = /\b(framework|paradigm|model|theor(?:y|ies|etical)|schema(?:tic)?|research design|hypothes[ie]s|conceptual)\b/i;

/**
 * The article's own figures: each <img> with its caption (a <figcaption>,
 * or a "Figure N." line right before/after it). Only http(s) images reach
 * the galley (src/lib/galley.ts sanitizer), so every src is fetchable.
 */
export function extractFigures(bodyHtml: string | null | undefined): ArticleFigure[] {
  if (!bodyHtml) return [];
  const out: ArticleFigure[] = [];
  const seen = new Set<string>();
  const imgRe = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(bodyHtml))) {
    const src = decodeEntities(m[1]);
    if (!/^https?:\/\//i.test(src) || seen.has(src)) continue;
    seen.add(src);
    // Only look between this image and its neighbours, so a caption is never
    // borrowed from the figure before or after.
    let before = bodyHtml.slice(Math.max(0, m.index - 900), m.index);
    const prevImg = before.toLowerCase().lastIndexOf("<img");
    if (prevImg >= 0) before = before.slice(before.indexOf(">", prevImg) + 1);
    let after = bodyHtml.slice(m.index, m.index + 1400);
    const nextImg = after.toLowerCase().indexOf("<img", 4);
    if (nextImg > 0) after = after.slice(0, nextImg);
    const figcap = after.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
    const textAfter = bodyHtml2Line(after.replace(/^<img\b[^>]*>/i, ""));
    const textBefore = bodyHtml2Line(before);
    const capLine = (s: string, fromEnd: boolean) => {
      const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
      const ordered = fromEnd ? lines.reverse() : lines;
      return ordered.slice(0, 2).find((l) => /^(figure|fig\.?)\s*\d+/i.test(l)) ?? "";
    };
    const altMatch = m[0].match(/\balt="([^"]*)"/i);
    const caption = squash(
      figcap ? bodyHtml2Line(figcap[1]) : capLine(textAfter, false) || capLine(textBefore, true) || decodeEntities(altMatch?.[1] ?? "")
    );
    const num = caption.match(/^(?:figure|fig\.?)\s*(\d+[a-z]?)/i)?.[1] ?? String(out.length + 1);
    out.push({ number: num, caption, src, isFramework: FRAMEWORK_CAPTION.test(caption) });
  }
  return out;
}

function bodyHtml2Line(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/(p|div|figure|figcaption|h[1-6]|li|table)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ).replace(/[ \t]+/g, " ");
}

// ─── LLM extraction ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior scientific editor preparing a research infographic, a conference poster, a graphical abstract and a framework diagram for a published journal article. You read the article and return its content as structured JSON.

Strict grounding rules:
- Use ONLY what the article states. Never invent results, numbers, theories, variables, participants or settings.
- Copy every number exactly as written in the article (same digits, decimals, symbols such as %, n =, p <).
- When the article does not state something, return "" (or [] for lists). Empty is correct; a guess is wrong.
- Write in clear, confident, plain academic English; keep each item short enough for a poster.

The framework must be the one THIS study actually uses:
- "variables": the study relates variables/constructs (independent → mediator → dependent, with moderators/controls). Use roles independent, mediator, moderator, dependent, control.
- "ipo": the study frames its work as an Input–Process–Output (conceptual paradigm). Use roles input, process, output; put the listed elements in "items".
- "theory": the study is anchored on named theories/concepts without measured variables. Use roles theory or concept.
- "none": the article names no framework, theory, model or variables.
Each construct label must be the article's own wording. Relationships use construct ids; label them with the article's hypothesis labels (H1, H2 …) when it has them, else a 1-3 word verb, else "".
Title the framework the way the article does ("Conceptual Framework", "Theoretical Framework", "Conceptual Paradigm", "Research Model", …).

Some articles are research proposals or thesis outlines (introduction and methodology only, written in the future tense: "this study will…"). For those set "stage" to "proposal" and return "findings": [], "conclusion": "", and no result numbers; put the stated hypotheses in "hypotheses" and the stated significance in "significance". Never present a research question, hypothesis or aim as a finding.
Write titles in normal title case even when the article's title is typed in capitals.

Respond with a single JSON object, no markdown:
{
 "stage": "results" | "proposal",
 "shortTitle": "<the article title shortened to at most 12 words, same meaning>",
 "background": "<the problem/context, 1-2 sentences, ≤ 45 words>",
 "objective": "<the aim, 1 sentence, ≤ 35 words>",
 "researchQuestions": ["<research question as stated>", "... at most 5"],
 "hypotheses": ["<hypothesis as stated>", "... at most 4"],
 "methods": {"design": "<≤ 14 words>", "participants": "<sample and size, ≤ 14 words>", "setting": "<where/when, ≤ 14 words>", "instruments": "<data collection tools, ≤ 14 words>", "analysis": "<analysis techniques, ≤ 14 words>"},
 "keyNumbers": [{"value": "<number exactly as written, e.g. 68.4% or n = 312 or r = .62>", "label": "<what it measures, ≤ 9 words>"}],
 "findings": ["<key finding, ≤ 28 words>", "... 3 to 5"],
 "conclusion": "<the main conclusion, ≤ 40 words>",
 "implications": ["<practical/theoretical implication or recommendation, ≤ 22 words>", "... 2 to 4"],
 "limitations": ["<limitation, ≤ 20 words>", "... at most 3"],
 "significance": "<who benefits / expected contribution as the article states it, ≤ 40 words>",
 "framework": {
   "layout": "variables" | "ipo" | "theory" | "none",
   "title": "<as the article names it>",
   "theories": [{"name": "<theory/model name as written>", "note": "<proponent and year, or 1-line role, ≤ 14 words>"}],
   "constructs": [{"id": "c1", "label": "<≤ 7 words>", "role": "<role>", "items": ["<indicator/dimension ≤ 6 words>"]}],
   "relationships": [{"from": "c1", "to": "c2", "label": "H1"}],
   "narrative": "<how the framework guides the study, 1-2 sentences, ≤ 45 words>"
 }
}
At most 4 keyNumbers, 9 constructs (each with at most 6 items) and 10 relationships.`;

const ROLES: ConstructRole[] = ["independent", "mediator", "moderator", "dependent", "control", "input", "process", "output", "theory", "concept"];
const LAYOUTS: FrameworkLayout[] = ["variables", "ipo", "theory", "none"];

function strArr(v: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? clip(x, maxLen) : ""))
    .filter(Boolean)
    .slice(0, max);
}

function str(v: unknown, maxLen: number): string {
  return typeof v === "string" ? clip(v, maxLen) : "";
}

/** Validates an LLM answer against the source; drops whatever is not grounded. */
export function sanitizeExtraction(raw: any, sourceText: string, title: string): Omit<ResearchVisualContent, "version" | "mode" | "model" | "generatedAt"> {
  const src = norm(sourceText);
  const m = raw?.methods ?? {};
  const keyNumbers = (Array.isArray(raw?.keyNumbers) ? raw.keyNumbers : [])
    .map((k: any) => ({ value: squash(String(k?.value ?? "")).slice(0, 18), label: str(k?.label, 70) }))
    .filter((k: { value: string; label: string }) => k.value && k.label && numberGroundedIn(k.value, src))
    .slice(0, 4);

  const fw = raw?.framework ?? {};
  let layout: FrameworkLayout = LAYOUTS.includes(fw.layout) ? fw.layout : "none";
  const theories = (Array.isArray(fw.theories) ? fw.theories : [])
    .map((t: any) => ({ name: str(t?.name, 80), note: str(t?.note, 100) }))
    .filter((t: { name: string }) => t.name && groundedIn(t.name, src, 0.67))
    .slice(0, 5);
  const constructs: FrameworkConstruct[] = (Array.isArray(fw.constructs) ? fw.constructs : [])
    .map((c: any, i: number) => ({
      id: squash(String(c?.id ?? `c${i + 1}`)) || `c${i + 1}`,
      label: str(c?.label, 60),
      role: (ROLES.includes(c?.role) ? c.role : "concept") as ConstructRole,
      items: strArr(c?.items, 6, 50).filter((it) => groundedIn(it, src, 0.5)),
    }))
    .filter((c: FrameworkConstruct) => c.label && groundedIn(c.label, src))
    .slice(0, 9);
  const ids = new Set(constructs.map((c) => c.id));
  const relationships = (Array.isArray(fw.relationships) ? fw.relationships : [])
    .map((r: any) => ({ from: String(r?.from ?? ""), to: String(r?.to ?? ""), label: squash(String(r?.label ?? "")).slice(0, 24) }))
    .filter((r: FrameworkRelationship) => ids.has(r.from) && ids.has(r.to) && r.from !== r.to)
    .slice(0, 10);

  if (layout === "ipo" && !constructs.some((c) => c.role === "input" || c.role === "process" || c.role === "output")) layout = constructs.length ? "variables" : "none";
  if (layout === "variables" && constructs.length < 2) layout = theories.length ? "theory" : "none";
  if (layout === "none" && theories.length) layout = "theory";
  if (layout === "theory" && !theories.length && !constructs.length) layout = "none";

  const stage: "results" | "proposal" = raw?.stage === "proposal" ? "proposal" : "results";
  const findings = stage === "proposal" ? [] : strArr(raw?.findings, 5, 220);
  return {
    stage,
    shortTitle: displayCase(str(raw?.shortTitle, 110) || clip(title, 110)),
    background: str(raw?.background, 330),
    objective: str(raw?.objective, 260),
    researchQuestions: strArr(raw?.researchQuestions, 5, 220),
    hypotheses: strArr(raw?.hypotheses, 4, 220),
    methods: {
      design: str(m.design, 110),
      participants: str(m.participants, 110),
      setting: str(m.setting, 110),
      instruments: str(m.instruments, 110),
      analysis: str(m.analysis, 110),
    },
    keyNumbers,
    findings,
    conclusion: stage === "proposal" ? "" : str(raw?.conclusion, 300),
    implications: strArr(raw?.implications, 4, 170),
    limitations: strArr(raw?.limitations, 3, 160),
    significance: str(raw?.significance, 280),
    framework: {
      layout,
      title: str(fw.title, 60) || defaultFrameworkTitle(layout),
      theories,
      constructs: layout === "none" ? [] : constructs,
      relationships: layout === "none" ? [] : relationships,
      narrative: str(fw.narrative, 340),
    },
  };
}

function defaultFrameworkTitle(layout: FrameworkLayout): string {
  if (layout === "ipo") return "Conceptual Paradigm";
  if (layout === "theory") return "Theoretical Framework";
  if (layout === "variables") return "Conceptual Framework";
  return "Theoretical Framework";
}

// ─── Display case ──────────────────────────────────────────────────────────

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "per", "the", "to", "vs", "via", "with", "among", "within", "del", "de", "la", "y"]);

/**
 * Many manuscripts arrive with the title (and author names) typed in
 * capitals. Printed that way a poster or infographic looks unfinished, so a
 * mostly-uppercase string is converted to title case. Acronyms in
 * parentheses ("(TLE)"), roman numerals and words with digits keep their
 * capitals; strings already in mixed case are returned unchanged.
 */
export function displayCase(raw: string): string {
  const s = squash(raw);
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6) return s;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (upper / letters.length < 0.8) return s;
  let afterBreak = true;
  return s
    .split(" ")
    .map((word) => {
      const first = afterBreak;
      afterBreak = /[:.?!—–]$/.test(word);
      if (/^\(?[A-Z0-9&-]{2,8}\)?[.,;:]?$/.test(word) && /^\(/.test(word)) return word; // "(TLE)"
      if (/\d/.test(word) || /^(I{1,3}|IV|V|VI{0,3}|IX|X)[.,:;]?$/.test(word)) return word;
      const lower = word.toLowerCase();
      const bare = lower.replace(/[^a-z]/g, "");
      if (!first && SMALL_WORDS.has(bare)) return lower;
      return lower.replace(/(^|[-‐/(“"‘'])([a-z])/g, (_, p, c) => p + c.toUpperCase());
    })
    .join(" ");
}

// ─── Article body sections ─────────────────────────────────────────────────

export type SectionKey =
  | "background" | "purpose" | "problem" | "hypotheses" | "framework" | "significance" | "scope"
  | "design" | "participants" | "setting" | "instruments" | "procedure" | "analysis"
  | "results" | "discussion" | "conclusion" | "recommendations" | "limitations"
  | "literature" | "definitions" | "ethics" | "stop";

export interface BodySection {
  heading: string;
  key: SectionKey;
  text: string;
  /** Bold sub-headings inside the section (variable names, instrument names…). */
  subheads: string[];
}

const SECTION_PATTERNS: [SectionKey, RegExp][] = [
  ["stop", /^(references?|bibliography|literature cited|works cited|appendix|appendices|curriculum vitae)\b/],
  ["literature", /^(review of )?(related )?literature\b|^review (of|and) related\b|^related (literature|studies|works?)\b|^literature review\b/],
  ["definitions", /^(definition|operational definition)s? of terms\b|^glossary\b/],
  ["ethics", /^ethic(s|al)\b/],
  ["hypotheses", /^(research |null )?hypothes[ie]s\b/],
  ["framework", /\b(theoretical|conceptual)\b.*\b(framework|lens|paradigm|model)\b|^theoretical lens\b|^(research|conceptual) paradigm\b|^theoretical (background|foundation|underpinnings?)\b|^framework of the study\b/],
  ["problem", /^(statement of the problem|research questions?|problem statement|research problems?)\b/],
  ["purpose", /^(purpose|aims?|objectives?|goals?)( and (objectives?|scope))?( of (the|this) (study|research))?$|^research objectives?\b|^purpose of the study\b/],
  ["significance", /^(significance|importance)( of (the|this) (study|research))?\b/],
  ["scope", /^scope\b/],
  ["limitations", /^(limitations?|delimitations?)\b/],
  ["background", /^(introduction|background( of (the|this) (study|research))?|rationale|the problem and its (setting|background)|context)$/],
  ["design", /^(research|study) design\b|^(research )?methodology$|^methods?$|^materials and methods\b|^research method\b|^design\b/],
  ["participants", /\b(respondents|participants|informants|subjects|sample|sampling|population)\b/],
  ["setting", /^(research |study )?(locale|setting|site|area|environment)( of the study)?$/],
  ["instruments", /\b(instruments?|questionnaires?|measures|data sources?|materials and instruments)\b/],
  ["procedure", /\b(data (gathering|collection)( procedures?)?|procedures?)\b/],
  ["analysis", /\b(statistical (tools?|treatment|analysis|techniques?)|data analysis|analysis of (the )?data|treatment of data)\b/],
  ["results", /^(results?|findings|presentation,? analysis|analysis and interpretation)\b/],
  ["discussion", /^discussion\b/],
  ["conclusion", /^(summary,? )?(conclusions?|concluding remarks)\b|^summary of findings\b/],
  ["recommendations", /^(recommendations?|implications?)\b/],
];

function headingKey(raw: string): SectionKey | null {
  const h = squash(raw)
    .toLowerCase()
    .replace(/^chapter\s+[ivx\d]+\s*[:.\-–]?\s*/, "")
    .replace(/^([ivx]+|\d+(\.\d+)*|[a-h])[.)]\s+/, "")
    .replace(/[\s:.;,]+$/, "");
  if (!h || /^chapter\b/.test(h)) return null;
  for (const [key, re] of SECTION_PATTERNS) if (re.test(h)) return key;
  return null;
}

/**
 * Splits the galley body into its own sections by heading. Manuscripts set
 * headings as <h1>–<h6> or as paragraphs that are entirely bold (typical of
 * Word theses). A table of contents also lists every heading, so when a key
 * appears more than once the section with the most text wins.
 */
export function splitBodySections(bodyHtml: string | null | undefined): BodySection[] {
  if (!bodyHtml) return [];
  const html = bodyHtml.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<table\b[\s\S]*?<\/table>/gi, " ");
  const blockRe = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const out: BodySection[] = [];
  let cur: BodySection | null = null;
  let stopped = false;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && !stopped) {
    const inner = m[2];
    const text = squash(decodeEntities(inner.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")));
    if (!text) continue;
    const bold = squash(decodeEntities([...inner.matchAll(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((x) => x[2].replace(/<[^>]+>/g, " ")).join(" ")));
    const isHeading = /^h/i.test(m[1]) || (text.length <= 110 && bold.length > 0 && bold === text);
    if (isHeading) {
      const key = headingKey(text);
      if (key === "stop") {
        // A table of contents lists "References" too; only stop once real content has been read.
        if (out.reduce((t, s) => t + s.text.length, 0) > 3000) stopped = true;
        cur = null;
        continue;
      }
      if (key) {
        cur = { heading: text, key, text: "", subheads: [] };
        out.push(cur);
        continue;
      }
      if (cur && !/^chapter\b/i.test(text)) cur.subheads.push(text.replace(/[.:]\s*$/, ""));
      continue;
    }
    if (!cur) continue;
    // A bold lead-in ("Pearson-r. The Pearson…", "QUESTIONNAIRE (CLE-Q). This…") names an item of the section.
    const lead = inner.match(/^\s*(?:<[^>]+>\s*)*?<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i);
    const leadText = lead ? squash(decodeEntities(lead[2].replace(/<[^>]+>/g, " "))) : "";
    if (leadText && leadText.length <= 120 && /[.:]$/.test(leadText) && text.startsWith(leadText.slice(0, 20))) cur.subheads.push(leadText.replace(/[.:]\s*$/, ""));
    cur.text += (cur.text ? "\n" : "") + text;
  }
  return out;
}

function pickSection(sections: BodySection[], key: SectionKey): BodySection | null {
  let best: BodySection | null = null;
  for (const s of sections) if (s.key === key && (!best || s.text.length > best.text.length)) best = s;
  return best && best.text.length >= 40 ? best : null;
}

// ─── Extractive fallback (no LLM) ──────────────────────────────────────────

const HEADING_LABELS: Record<string, keyof ReturnType<typeof emptySections>> = {
  background: "background", introduction: "background", context: "background", rationale: "background", problem: "background",
  purpose: "objective", aim: "objective", aims: "objective", objective: "objective", objectives: "objective",
  methods: "methods", method: "methods", methodology: "methods", "design/methodology/approach": "methods", design: "methods", approach: "methods", "materials and methods": "methods",
  results: "results", findings: "results",
  conclusion: "conclusion", conclusions: "conclusion",
  implications: "implications", "practical implications": "implications", recommendations: "implications",
  limitations: "limitations", "research limitations/implications": "limitations",
};

function emptySections() {
  return { background: "", objective: "", methods: "", results: "", conclusion: "", implications: "", limitations: "" };
}

const AIM_RE = /\b(aims?|aimed|purpose|objectives?|seeks?|sought|intends?|this (study|paper|research|inquiry|article|investigation) (examines|investigates|explores|assesses|determines|analy[sz]es|evaluates|describes)|we (examine|investigate|explore|assess|evaluate|test))\b/i;
const QUESTION_RE = /\?\s*$|\b(whether|seeks? to answer|the following questions)\b/i;
const RESULT_RE = /\b(found|find that|revealed|reveals|showed|shows that|shown|indicated|indicates|indicate that|demonstrated|demonstrates|yielded|ranged|emerged|identified|reported|observed|was associated|were associated|increased|decreased|reduced|improved|retained|explained|predicted|outperformed|achieved)\b/i;
const METHOD_RE = /\b(survey(ed)?|questionnaires?|interview(s|ed)?|participants|respondents|informants|sampled|sample|sampling|recruited|collected|design|regression|anova|qualitative|quantitative|mixed[- ]methods?|thematic|descriptive|correlational|experimental|cross-sectional|longitudinal|models?)\b/i;
const CONCLUDE_RE = /\b(conclude[sd]?|in conclusion|overall|we (provide|propose|recommend|offer)|implications?|recommend(s|ed)?|should)\b/i;
const FUTURE_RE = /\bwill (be|utilize|use|employ|select|interview|conduct|determine|gather|collect|administer|follow|adopt)\b/gi;

function abstractSections(abstract: string) {
  const s = emptySections();
  const text = squash(abstract);
  const labels = Object.keys(HEADING_LABELS).sort((a, b) => b.length - a.length).map((l) => l.replace(/[/]/g, "\\/"));
  const re = new RegExp(`(?:^|\\s)(${labels.join("|")})\\s*[:.–—-]\\s+`, "gi");
  const marks: { key: keyof typeof s; at: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = HEADING_LABELS[m[1].toLowerCase()];
    if (key) marks.push({ key, at: m.index, end: m.index + m[0].length });
  }
  if (marks.length >= 2) {
    marks.forEach((mk, i) => {
      const body = text.slice(mk.end, marks[i + 1]?.at ?? text.length).trim();
      s[mk.key] = s[mk.key] ? `${s[mk.key]} ${body}` : body;
    });
    return s;
  }
  // Unstructured abstract: classify each sentence. A numbered list of
  // research questions is never a finding.
  for (const sent of sentences(text.replace(/\s\d{1,2}\.(?:\s?\d{1,2})?\.?\s(?=[A-Za-z])/g, " "))) {
    if (/^\d+(\.\d+)*$/.test(sent) || /\bspecifically, this (study|research)\b/i.test(sent)) continue;
    const future = /\bwill\b/i.test(sent);
    if (!s.objective && (AIM_RE.test(sent) || (QUESTION_RE.test(sent) && /\b(this|the present) (study|research|inquiry|paper)\b/i.test(sent)))) s.objective = sent;
    else if (QUESTION_RE.test(sent)) continue;
    else if (/^(we|this (study|paper)) (provide|propose|offer|recommend|conclude)/i.test(sent) && !s.conclusion) s.conclusion = sent;
    else if (!future && RESULT_RE.test(sent) && !/^(we|this study) (sampled|surveyed|interviewed|collected|recruited)\b/i.test(sent)) s.results += ` ${sent}`;
    else if (METHOD_RE.test(sent) && s.methods.length < 400) s.methods += ` ${sent}`;
    else if (CONCLUDE_RE.test(sent) && !s.conclusion) s.conclusion = sent;
    else if (!s.background && !s.objective && !s.results) s.background = sent;
  }
  return s;
}

/** Drops in-text citations such as "(Smith & Lee, 2021)" for tight layouts. */
function stripCitations(s: string): string {
  return squash(s.replace(/\s*\((?:[^()]*?(?:19|20)\d{2}[a-z]?[^()]*?)\)/g, "").replace(/\s+([.,;])/g, "$1"));
}

function firstSentences(text: string, n: number, skip: (s: string) => boolean = () => false): string[] {
  return sentences(text).filter((s) => !skip(s)).slice(0, n);
}

interface NumberedItem {
  main: string;
  subs: string[];
}

/** "1. … 1.1 …; 1.2 …" lists (research questions, hypotheses) as written. */
function numberedList(text: string): NumberedItem[] {
  const items: NumberedItem[] = [];
  const lines = text.split(/\n|(?=\s(?:\d{1,2}\.\s?\d{1,2}|\d{1,2}\.)\s+[A-Za-z])/).map((l) => squash(l)).filter(Boolean);
  let last: { item: NumberedItem; sub: boolean } | null = null;
  for (const line of lines) {
    const sub = line.match(/^\d{1,2}\.\s?\d{1,2}\.?\s+(.+)$/);
    const main = !sub && line.match(/^\d{1,2}[.)]?\s+(?=[A-Za-z])(.+)$/);
    if (sub && last) {
      last.item.subs.push(sub[1]);
      last.sub = true;
    } else if (main) {
      const item = { main: main[1], subs: [] };
      items.push(item);
      last = { item, sub: false };
    } else if (last) {
      // Continuation of a wrapped line.
      if (last.sub) last.item.subs[last.item.subs.length - 1] += ` ${line}`;
      else last.item.main += ` ${line}`;
    }
  }
  return items.map((i) => ({ main: squash(i.main), subs: i.subs.map((x) => squash(x)) }));
}

function cleanItem(s: string): string {
  const t = squash(s).replace(/^(and|or)\s+/i, "").replace(/[;,.?]+$/, "").replace(/;?\s+and$/i, "").replace(/[;,]$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function researchQuestionsFrom(items: NumberedItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const main = it.main.replace(/\s+/g, " ");
    if (/in terms of\s*:?$/i.test(main) || !it.subs.length) {
      out.push(main.replace(/,?\s*in terms of\s*:?$/i, "").replace(/[:;]$/, "").replace(/\?*$/, "?"));
    } else {
      // "Is there a significant relationship between: 4.1 … 4.2 …" → one question per sub-item.
      for (const sub of it.subs) out.push(`${main.replace(/:\s*$/, "")} ${sub.replace(/[;.]+$/, "").replace(/;?\s*and$/i, "")}`.replace(/\?*$/, "?"));
    }
  }
  // A long locative phrase repeated in every question ("among secondary
  // institutions in the Province of …") is stated once under Setting.
  const loc = new Map<string, number>();
  for (const q of out) {
    const lm = q.match(/\s+among\s+[^?:;]{10,140}?(?=\s+in terms of|[?:;]|$)/i);
    if (lm) loc.set(lm[0], (loc.get(lm[0]) ?? 0) + 1);
  }
  return out
    .map((q) => {
      let r = q;
      for (const [phrase, n] of loc) if (n >= 2) r = r.replace(phrase, "");
      return clip(r.replace(/\s+\?/, "?"), 220);
    })
    .filter((q) => q.length > 10)
    .slice(0, 6);
}

function stem(w: string): string {
  return w.replace(/ies$/, "y").replace(/(?<!s)s$/, "").replace(/’|'/g, "");
}

function tokens(s: string): string[] {
  return norm(s)
    .replace(/[’']s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !["what", "level", "terms", "learning"].includes(w))
    .map(stem);
}

/** Share of `a`'s meaningful words that also occur in `b`. */
function overlap(a: string, b: string): number {
  const ta = tokens(a);
  if (!ta.length) return 0;
  const tb = new Set(tokens(b));
  return ta.filter((w) => tb.has(w)).length / ta.length;
}

const DESIGN_TERMS: [RegExp, string][] = [
  [/\bmixed[- ]methods?\b/i, "mixed-methods"],
  [/\bquantitative\b/i, "quantitative"],
  [/\bqualitative\b/i, "qualitative"],
  [/\bdescriptive[- ]correlational\b/i, "descriptive-correlational"],
  [/\bdescriptive (research|design|method|approach|study|survey|type)\b|\bdescriptive and correlational\b/i, "descriptive"],
  [/\bcorrelational\b/i, "correlational"],
  [/\bcausal[- ]comparative\b/i, "causal-comparative"],
  [/\bquasi[- ]experimental\b/i, "quasi-experimental"],
  [/\b(?<!quasi[- ])experimental\b/i, "experimental"],
  [/\bphenomenolog(y|ical)\b/i, "phenomenological"],
  [/\bcase stud(y|ies)\b/i, "case study"],
  [/\bethnograph(y|ic)\b/i, "ethnographic"],
  [/\bgrounded theory\b/i, "grounded theory"],
  [/\bnarrative (inquiry|research)\b/i, "narrative inquiry"],
  [/\baction research\b/i, "action research"],
  [/\bcross-sectional\b/i, "cross-sectional"],
  [/\blongitudinal\b/i, "longitudinal"],
  [/\bsystematic review\b/i, "systematic review"],
  [/\bmeta-analys[ie]s\b/i, "meta-analysis"],
  [/\bsurvey (design|research|method)\b/i, "survey"],
];

const ANALYSIS_TERMS: [RegExp, string][] = [
  [/\bweighted mean\b/i, "weighted mean"],
  [/\b(arithmetic )?mean\b(?! square)/i, "mean"],
  [/\bstandard deviation\b/i, "standard deviation"],
  [/\bfrequenc(y|ies)\b.*\bpercentage|\bpercentage\b/i, "frequency and percentage"],
  [/\bpearson[- ]?(r\b|product[- ]moment|correlation)/i, "Pearson r"],
  [/\bspearman/i, "Spearman rho"],
  [/\bmultiple (linear )?regression\b/i, "multiple regression analysis"],
  [/\blogistic regression\b/i, "logistic regression"],
  [/\b(simple )?linear regression\b/i, "linear regression"],
  [/\bhierarchical regression\b/i, "hierarchical regression"],
  [/\bmixed[- ]effects? models?\b/i, "mixed-effects models"],
  [/\bt-?tests?\b/i, "t-test"],
  [/\banova\b|\banalysis of variance\b/i, "ANOVA"],
  [/\bchi[- ]square\b/i, "chi-square test"],
  [/\bstructural equation model/i, "structural equation modelling"],
  [/\b(confirmatory|exploratory) factor analysis\b/i, "factor analysis"],
  [/\bmediation analysis\b/i, "mediation analysis"],
  [/\bmoderation analysis\b/i, "moderation analysis"],
  [/\bthematic analysis\b/i, "thematic analysis"],
  [/\bcontent analysis\b/i, "content analysis"],
  [/\b(data|open|axial|thematic|in vivo|selective) coding\b/i, "data coding"],
  [/\bcolaizzi\b/i, "Colaizzi's method"],
];

const INSTRUMENT_TERMS: [RegExp, string][] = [
  [/\bin-depth interviews?\b/i, "in-depth interviews"],
  [/\bsemi-structured interviews?\b/i, "semi-structured interviews"],
  [/\binterview guide\b/i, "interview guide"],
  [/\bfocus group discussions?\b|\bFGDs?\b/, "focus group discussions"],
  [/\bobservation (checklist|guide)\b/i, "observation checklist"],
  [/\b(adapted|adopted|modified|standardized|researcher-made) (survey )?questionnaires?\b/i, "$&"],
  [/\bsurvey questionnaires?\b/i, "survey questionnaire"],
];

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };

function termList(text: string, terms: [RegExp, string][], max: number): string[] {
  const found: { at: number; label: string }[] = [];
  for (const [re, label] of terms) {
    const m = text.match(re);
    if (!m) continue;
    const l = label === "$&" ? m[0].toLowerCase() : label;
    if (found.some((f) => f.label.includes(l) || l.includes(f.label))) continue;
    found.push({ at: m.index ?? 0, label: l });
  }
  return found.sort((a, b) => a.at - b.at).slice(0, max).map((f) => f.label);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmtInt(n: string): string {
  const v = Number(n.replace(/,/g, ""));
  return Number.isFinite(v) && v >= 1000 ? v.toLocaleString("en-US") : n;
}

interface MethodFacts {
  design: string;
  participants: string;
  setting: string;
  instruments: string;
  analysis: string;
  numbers: { value: string; label: string }[];
}

function methodFacts(get: (k: SectionKey) => BodySection | null, all: string, abstractText: string): MethodFacts {
  const designS = get("design");
  const partS = get("participants");
  const instS = get("instruments");
  const anaS = get("analysis");
  const designText = [designS?.text ?? "", partS?.text ?? ""].join("\n");
  const terms = termList(designS?.text || (partS ? designText : abstractText), DESIGN_TERMS, 4).filter(
    (t, _, arr) => !(t === "descriptive" || t === "correlational") || !arr.includes("descriptive-correlational")
  );
  // "descriptive" + "correlational" → "descriptive-correlational"
  const merged = terms.includes("descriptive") && terms.includes("correlational") ? terms.filter((t) => t !== "correlational").map((t) => (t === "descriptive" ? "descriptive-correlational" : t)) : terms;
  const design = merged.length ? `${capFirst(joinList(merged))} design` : designS ? clip(stripCitations(firstSentences(designS.text, 1)[0] ?? ""), 140) : "";

  const pText = partS?.text ?? designText;
  const numbers: { value: string; label: string }[] = [];
  let participants = "";
  const nouns = "respondents|participants|informants|students|teachers|pupils|learners|employees|nurses|patients|parents|counselors|counsellors|principals|administrators|households|farmers|faculty members|individuals";
  const sample =
    pText.match(new RegExp(`sample size (?:is|was|will be)?\\s*(?:determined to be|computed to be|set at|of)?\\s*(\\d[\\d,]*)\\s+(${nouns})`, "i")) ??
    pText.match(new RegExp(`\\b(?:a total of|total of|composed of|consist(?:s|ed|ing)? of|comprised? of|involve[sd]?|interview|select)\\s+(?:(?:[a-z]+)\\s+)?\\(?(\\d[\\d,]*)\\)?\\s+(?:[a-z-]+\\s+){0,3}?(${nouns})`, "i")) ??
    pText.match(new RegExp(`\\b(\\d[\\d,]*)\\s+(?:[a-z-]+\\s+){0,3}?(${nouns})`, "i"));
  if (sample) {
    const n = sample[1];
    const noun = sample[2].toLowerCase();
    const pop = pText.match(/(?:total )?population of (\d[\d,]*)/i)?.[1];
    const sampling = termList(pText + "\n" + (designS?.text ?? ""), [
      [/\bpurposive sampling\b/i, "purposive sampling"],
      [/\bstratified random sampling\b/i, "stratified random sampling"],
      [/\bsimple random sampling\b/i, "simple random sampling"],
      [/\bconvenience sampling\b/i, "convenience sampling"],
      [/\bsnowball sampling\b/i, "snowball sampling"],
      [/\bcluster sampling\b/i, "cluster sampling"],
      [/\bsystematic (random )?sampling\b/i, "systematic sampling"],
      [/\btotal enumeration\b|\bcomplete enumeration\b/i, "total enumeration"],
      [/\brandom sampling\b/i, "random sampling"],
    ], 1)[0];
    participants = `${fmtInt(n)} ${noun}${pop ? ` from a population of ${fmtInt(pop)}` : ""}${sampling ? `, ${sampling}` : ""}`;
    numbers.push({ value: fmtInt(n), label: capFirst(`${noun} in the sample`) });
    if (pop) numbers.push({ value: fmtInt(pop), label: capFirst(`${noun} in the population`) });
  } else {
    const wn = pText.match(new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\s+(?:[a-z-]+\\s+){0,3}?(${nouns})`, "i"));
    if (wn) participants = `${WORD_NUMBERS[wn[1].toLowerCase()]} ${wn[2].toLowerCase()}`;
  }

  const locS = get("setting")?.text ?? pText;
  const PLACE = /\b((?:[Pp]rovince|[Dd]ivision|[Cc]ity|[Mm]unicipality|[Rr]egion|[Dd]istrict|[Cc]ounty|[Ss]tate|[Ss]chools [Dd]ivision) of [A-Z][\w'’-]*(?:\s+(?:del|de|la|[A-Z][\w'’-]*))*)/;
  const place = locS.match(PLACE)?.[1] ?? all.match(PLACE)?.[1];
  const sy = locS.match(/\b(?:school year|S\.?Y\.?|academic year|A\.?Y\.?)\s*(\d{4}\s*[-–]\s*\d{4})/i)?.[1];
  const setting = [place ? capFirst(place.replace(/\s+(del|de|la)\s+/gi, (x) => x.toLowerCase())) : "", sy ? `SY ${sy.replace(/\s+/g, "")}` : ""].filter(Boolean).join(", ");

  const instText = (instS?.text ?? "") + "\n" + (instS?.subheads.join("\n") ?? "");
  const named = [...new Set((instS?.subheads ?? []).filter((h) => /\b(questionnaire|scale|inventory|test|checklist|interview guide|instrument)\b/i.test(h) && h.length <= 110).map((h) => displayCase(h.replace(/\.\s*$/, ""))))];
  const named2 = named.length ? named : [...instText.matchAll(/\b((?:[A-Z][\w’'-]*\s+){1,7}(?:Questionnaire|Scale|Inventory|Test|Survey))\s*\(([A-Z][A-Za-z-]{1,10})\)/g)].map((x) => `${squash(x[1])} (${x[2]})`);
  const fitNames = (names: string[]) => names.reduce((acc, n) => (acc.length < 3 && [...acc, n].join("; ").length <= 210 ? [...acc, n] : acc), [] as string[]).join("; ");
  const instruments = named2.length ? fitNames(named2) : capFirst(joinList(termList(instText + "\n" + (partS?.text ?? "") + "\n" + (designS?.text ?? ""), INSTRUMENT_TERMS, 3)));

  // Statistical tools are often listed under the data-gathering procedure instead.
  const anaSrc = anaS ?? get("procedure");
  const anaText = anaSrc ? `${anaSrc.text}\n${anaSrc.subheads.join("\n")}` : "";
  const analysis = capFirst(joinList(termList(anaText || abstractText, ANALYSIS_TERMS, 5)));
  const alpha = all.match(/\b(0?\.0[15])\s+(?:level of significance|significance level|alpha level)/i)?.[1];
  if (alpha) numbers.push({ value: alpha.startsWith(".") ? `0${alpha}` : alpha, label: "Level of significance (alpha) for hypothesis tests" });
  return { design: clip(design, 140), participants: clip(participants, 140), setting: clip(setting, 140), instruments: clip(instruments, 220), analysis: clip(analysis, 140), numbers };
}

const NUMBER_RE = /(\b[nN]\s*=\s*\d[\d,]*|\b[rRpβbt]\s*[=<>]\s*-?\.?\d+(?:\.\d+)?|\bR²?\s*=\s*\.?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\b\d{2,}(?:,\d{3})*\s+(?:participants|respondents|students|teachers|patients|schools|households|articles|studies|firms|items))/g;

export function extractKeyNumbers(text: string, max = 4): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const sent of sentences(text)) {
    // A range ("ranged from 61% to 89%") is one number, labelled by what precedes it.
    for (const r of sent.matchAll(/(\d+(?:\.\d+)?)\s*%?\s*(?:to|–|-)\s*(\d+(?:\.\d+)?)\s*%/g)) {
      const value = `${r[1]}–${r[2]}%`;
      const label = squash(sent.slice(0, r.index).replace(/\b(ranged|ranging|varied|varying)?\s*(from|between)?\s*$/i, "")).split(/[,;:()]/).pop()?.trim().split(" ").slice(-7).join(" ") ?? "";
      if (label.length >= 3 && !seen.has(value) && out.length < max) {
        seen.add(value);
        seen.add(`${r[1]}%`);
        seen.add(`${r[2]}%`);
        out.push({ value, label: capFirst(label) });
      }
    }
    // A count of study units ("48 biofilter cells", "312 teachers").
    for (const c of sent.matchAll(/\b(\d{2,}(?:,\d{3})*)\s+((?:[a-z-]+\s+)?(?:participants|respondents|students|teachers|patients|schools|households|articles|studies|firms|items|cells|sites|cities|countries|samples|hospitals|villages|plots|farms|companies|clinics|classrooms))\b/g)) {
      if (seen.has(c[1]) || /^(19|20)\d{2}$/.test(c[1]) || out.length >= max) continue;
      seen.add(c[1]);
      out.push({ value: c[1], label: capFirst(c[2]) });
    }
    for (const m of sent.matchAll(NUMBER_RE)) {
      const value = squash(m[1]).replace(/\s+(participants|respondents|students|teachers|patients|schools|households|articles|studies|firms|items)$/i, "");
      if (seen.has(value) || /^(19|20)\d{2}$/.test(value)) continue;
      const tail = squash(m[1]).match(/\s+(\w+)$/)?.[1];
      const before = sent.slice(0, m.index).split(/[,;:()]/).pop() ?? "";
      const afterTxt = sent.slice((m.index ?? 0) + m[0].length).split(/[,;:().]/)[0] ?? "";
      let label = squash(tail && !/\d/.test(tail) ? tail : /%/.test(value) ? `${before} ${afterTxt}` : before || afterTxt)
        .split(" ")
        .filter(Boolean)
        .slice(-9)
        .join(" ");
      label = label.replace(/^(and|or|of|with|the|a|an|to|in)\s+/i, "").replace(/\s+(of|was|were|is|are|had|with)$/i, "");
      if (label.length < 3) continue;
      seen.add(value);
      out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
      if (out.length >= max) return out;
    }
  }
  return out;
}

const THEORY_RE = /\b((?:[A-Z][\w'’-]+\s+){0,4}(?:[A-Z][\w'’-]+))(?:'s)?\s+(Theory|Model|Framework|Paradigm|Hierarchy of Needs|Taxonomy)\b(\s*\([A-Z]{2,8}\))?|\b(?:theory|model) of ((?:[A-Z][\w'’-]+\s*){1,4})/g;
const NOT_A_THEORY = /\b(problem|conceptual|theoretical|framework|chapter|study|research|figure|table|this|the|our)\b/i;

export function extractTheories(text: string): { name: string; note: string }[] {
  const out: { name: string; note: string }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(THEORY_RE)) {
    let name: string;
    if (m[1]) {
      const lead = squash(m[1]).replace(/^(The|This|Our|A|An|In|Using|Under|Also|Additionally|Moreover|Finally|Lastly)\s+/, "");
      if (NOT_A_THEORY.test(lead)) continue;
      name = `${lead} ${m[2]}${m[3] ? ` ${squash(m[3])}` : ""}`;
    } else {
      const g = squash(m[4]);
      name = /\b(Theory|Model)$/.test(g) ? g : `Theory of ${g}`;
    }
    if (name.split(" ").length < 2 || name.length > 80) continue;
    // Proponent/year from the citation in the same sentence: "(Deci & Ryan, 1985)".
    const tail = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 260).split(/(?<=[.!?])\s/)[0];
    const cite = tail.match(/\(([^()]{2,60}?,?\s*(?:19|20)\d{2}[a-z]?)\)/)?.[1] ?? tail.match(/^\s*\(((?:19|20)\d{2})\)/)?.[1] ?? "";
    out.push({ name, note: squash(cite).replace(/,(\S)/g, ", $1") });
  }
  // Drop duplicates and fragments of a longer name ("Learning Theory" ⊂ "Constructivist Learning Theory").
  const result: { name: string; note: string }[] = [];
  for (const t of out) {
    const k = t.name.toLowerCase().replace(/\s*\([a-z]+\)$/, "");
    if (seen.has(k)) continue;
    if (out.some((o) => o !== t && o.name.length > t.name.length && o.name.toLowerCase().includes(k))) continue;
    seen.add(k);
    result.push(t);
    if (result.length >= 4) break;
  }
  return result;
}

/** IVs → DV from the stated aim or the title ("X and Y as predictors of Z"). */
function variablesFrom(aim: string, title: string): { ivs: string[]; dv: string } | null {
  const cut = (s: string) =>
    squash(s)
      .replace(/^(the|a|an)\s+/i, "")
      .split(/\s+(?:among|within|at)\s+|\s+in\s+(?:local|public|private|selected|select|the|state|higher)\b|[.?;]/i)[0]
      .trim();
  const split = (s: string) => {
    const parts = s.split(/\s*,\s*(?:and\s+)?|\s+and\s+/).map((p) => p.replace(/^(the|a|an)\s+/i, "").trim()).filter(Boolean);
    return parts.length > 1 && parts.every((p) => p.split(" ").length >= 2) ? parts : [s];
  };
  const pats = [
    { s: aim, re: /\bwhether\s+(.+?)\s+(?:significantly\s+|positively\s+|negatively\s+)?(?:influences?|predicts?|affects?|impacts?|determines?|explains?)\s+(.+)/i },
    { s: title, re: /^(.+?)(?:\s+as|:)\s+(?:significant\s+)?(?:predictors?|determinants?)\s+of\s+(.+)$/i },
    { s: aim, re: /\b(?:influence|effects?|impact)\s+of\s+(.+?)\s+on\s+(.+)/i },
    { s: title, re: /\b(?:influence|effects?|impact)\s+of\s+(.+?)\s+on\s+(.+)/i },
  ];
  for (const { s, re } of pats) {
    const m = squash(s).match(re);
    if (!m) continue;
    const ivs = split(cut(m[1]));
    const dv = cut(m[2]);
    if (dv.split(" ").length >= 1 && ivs.every((v) => v.length >= 4 && v.length <= 90) && dv.length >= 4 && dv.length <= 120) return { ivs, dv };
  }
  return null;
}

/** The full title, minus a trailing locative ("… in Local Colleges in Davao del Norte") when it is long. */
function shortTitleOf(title: string): string {
  let t = squash(title);
  if (t.length > 110) {
    const m = t.match(/^(.{50,}?)\s+(?:in|among|at)\s+(?:the\s+)?(?:(?:[Ll]ocal|[Pp]ublic|[Pp]rivate|[Ss]elected|[Ss]elect|[Ss]econdary|[Tt]ertiary|[Hh]igher)\b[^:]*|[A-Z][\w’'-]*(?:\s+(?:del|de|of|[A-Z][\w’'-]*))*)$/);
    if (m) t = m[1];
  }
  return clip(t, 170);
}

export type StudyStage = "results" | "proposal";

export interface BodyFacts {
  sections: BodySection[];
  stage: StudyStage | null;
}

/**
 * Whether the published text reports results. Graduate-thesis "outline"
 * manuscripts (Chapters 1–3) describe what the study *will* do and have no
 * Results/Conclusions; their documents must never show findings.
 */
export function detectStage(sections: BodySection[], abstract: string): StudyStage | null {
  const get = (k: SectionKey) => pickSection(sections, k);
  const reported = (get("results")?.text.length ?? 0) + (get("conclusion")?.text.length ?? 0) + (get("discussion")?.text.length ?? 0);
  if (reported > 400) return "results";
  const methodText = [get("design"), get("participants"), get("analysis"), get("procedure")].map((s) => s?.text ?? "").join("\n");
  if ((methodText.match(FUTURE_RE)?.length ?? 0) >= 2) return "proposal";
  if (sections.length >= 4 && reported === 0 && get("design")) return "proposal";
  const abs = sentences(squash(abstract));
  if (abs.some((s) => !/\bwill\b/i.test(s) && !QUESTION_RE.test(s) && RESULT_RE.test(s))) return "results";
  if ((abstract.match(FUTURE_RE)?.length ?? 0) >= 1) return "proposal";
  return null;
}

export function extractiveContent(src: ResearchSource, bodyText: string): Omit<ResearchVisualContent, "version" | "mode" | "model" | "generatedAt"> {
  const sections = splitBodySections(src.bodyHtml);
  const get = (k: SectionKey) => pickSection(sections, k);
  const stage = detectStage(sections, src.abstract) ?? "results";
  const abs = abstractSections(src.abstract);
  const title = displayCase(src.title);
  const all = `${src.abstract}\n${bodyText}`;

  // Background, aim
  const bg = get("background");
  const background = bg
    ? clip(stripCitations(firstSentences(bg.text, 2, (s) => s.length < 40).join(" ")), 330)
    : clip(firstSentences(abs.background, 2).join(" "), 330);
  const purpose = get("purpose");
  const problem = get("problem");
  const aimFrom = (t: string | undefined) => (t ? sentences(t).find((s) => AIM_RE.test(s) && !/^specifically\b/i.test(s)) ?? "" : "");
  const objective = clip(stripCitations(aimFrom(purpose?.text) || aimFrom(problem?.text) || abs.objective || aimFrom(src.abstract)), 320);

  // Research questions and hypotheses, exactly as numbered in the article
  const rqSource = problem?.text ?? (/\b1\.\s/.test(src.abstract) ? src.abstract : "") ?? "";
  const rqItems = numberedList(rqSource).filter((i) => /\?|:\s*$/.test(i.main) || i.subs.some((x) => /\?/.test(x)));
  const researchQuestions = researchQuestionsFrom(rqItems);
  const hypSection = get("hypotheses");
  const locative = /\s+among\s+[^.?:;]{10,140}?(?=\s+in terms of|[.?:;]|$)/i;
  const repeated: string[] = [...(rqSource.match(new RegExp(locative.source, "gi")) ?? [])];
  const commonLoc = repeated.find((ph, i) => repeated.indexOf(ph) !== i);
  const hypotheses = hypSection
    ? numberedList(hypSection.text)
        .map((h) => clip(commonLoc ? h.main.replace(commonLoc, "") : h.main, 220))
        .filter((h) => h.length > 15)
        .slice(0, 5)
    : [];

  // Methods
  const mf = methodFacts(get, all, src.abstract);
  const methods = {
    design: mf.design || clip(abs.methods, 140),
    participants: mf.participants,
    setting: mf.setting,
    instruments: mf.instruments,
    analysis: mf.analysis,
  };

  // Results (only when the article reports them)
  const resultsS = get("results");
  const conclusionS = get("conclusion");
  const recS = get("recommendations");
  let findings: string[] = [];
  let conclusion = "";
  let implications: string[] = [];
  let keyNumbers = mf.numbers.slice(0, 4);
  if (stage === "results") {
    const resultText = resultsS?.text ?? abs.results;
    findings = firstSentences(resultText, 4, (s) => /\bwill\b/i.test(s) || QUESTION_RE.test(s) || !RESULT_RE.test(s)).map((f) => clip(stripCitations(f), 220));
    if (!findings.length && conclusionS) findings = numberedList(conclusionS.text).map((i) => clip(i.main, 220)).slice(0, 4);
    const concl = conclusionS ? firstSentences(conclusionS.text, 2, (s) => /:\s*$/.test(s)).join(" ") : abs.conclusion;
    conclusion = clip(stripCitations(concl), 300);
    const recItems = recS ? numberedList(recS.text).map((i) => i.main) : [];
    implications = (recItems.length ? recItems : recS ? firstSentences(recS.text, 3, (s) => /:\s*$/.test(s)) : firstSentences(abs.implications, 3)).map((f) => clip(stripCitations(f), 170)).slice(0, 3);
    const resultNums = extractKeyNumbers(`${resultText} ${abs.methods} ${src.abstract}`);
    keyNumbers = [...resultNums, ...mf.numbers.filter((n) => !resultNums.some((r) => r.value === n.value))].slice(0, 4);
  }
  if (!findings.length && stage === "results" && !resultsS) {
    findings = firstSentences(src.laySummary ?? "", 3, (s) => !RESULT_RE.test(s) || /\bwill\b/i.test(s)).map((f) => clip(f, 220));
  }

  const sig = get("significance");
  const significance = sig ? clip(stripCitations(firstSentences(sig.text, 2, (s) => /:\s*$/.test(s) || s.length < 40 || /\bthe following\b/i.test(s)).join(" ")), 280) : "";
  const lim = get("limitations") ?? get("scope");
  // A "Scope and limitations" section mostly describes scope; keep only sentences that state a limit.
  const LIMIT_RE = /\b(limit(s|ed|ation)?|only|restricted|confined|cannot|could not|not (cover|include|generali[sz]e)|exclud(e|ed|es)|generali[sz]ab|delimit)/i;
  const limitations = lim ? firstSentences(lim.text, 2, (s) => s.length < 40 || !LIMIT_RE.test(s)).map((f) => clip(stripCitations(f), 160)) : firstSentences(abs.limitations, 2).map((f) => clip(f, 160));

  // Framework: the study's own variables (and indicators), else its named theories
  const fwS = get("framework");
  const theories = extractTheories(fwS ? `${fwS.text}` : `${src.abstract}\n${bodyText.slice(0, 40000)}`);
  const vars = variablesFrom(objective || src.abstract, src.title);
  const constructs: FrameworkConstruct[] = [];
  const relationships: FrameworkRelationship[] = [];
  if (vars) {
    const subheads = fwS?.subheads.filter((h) => h.length <= 110 && !/^(independent|dependent|moderating|mediating|intervening)\b|^figure\b/i.test(h)) ?? [];
    const labelFor = (phrase: string) => {
      const best = subheads.map((h) => ({ h, o: overlap(phrase, h) })).sort((a, b) => b.o - a.o)[0];
      return clip(displayCase(best && best.o >= 0.6 ? best.h : capFirst(phrase)), 96);
    };
    const levelItems = rqItems
      .filter((i) => i.subs.length && /in terms of\s*:?$/i.test(i.main))
      .map((i) => ({ what: i.main.match(/\b(?:level|extent|status|profile|degree) of (?:the\s+)?(.+?)(?:\s+(?:among|of|in|at)\s+.*)?\s*,?\s*in terms of/i)?.[1] ?? i.main, items: i.subs.map(cleanItem) }));
    const itemsFor = (phrase: string) => {
      const hit = levelItems.map((l) => ({ l, o: overlap(l.what, phrase) })).sort((a, b) => b.o - a.o)[0];
      return hit && hit.o >= 0.6 ? hit.l.items.slice(0, 6).map((x) => clip(x, 50)) : [];
    };
    vars.ivs.forEach((iv, i) => constructs.push({ id: `iv${i + 1}`, label: labelFor(iv), role: "independent", items: itemsFor(iv) }));
    constructs.push({ id: "dv", label: labelFor(vars.dv), role: "dependent", items: itemsFor(vars.dv) });
    vars.ivs.forEach((iv, i) => {
      const k = hypotheses.findIndex((h) => overlap(iv, h) >= 0.6 && overlap(vars.dv, h) >= 0.5 && vars.ivs.every((o) => o === iv || overlap(o, h) < 0.6));
      relationships.push({ from: `iv${i + 1}`, to: "dv", label: k >= 0 ? `H${k + 1}` : "" });
    });
  }
  const layout: FrameworkLayout = constructs.length >= 2 ? "variables" : theories.length ? "theory" : "none";
  const fwHeading = fwS ? displayCase(fwS.heading.replace(/[.:]\s*$/, "")) : "";
  const narrative = fwS ? clip(stripCitations(firstSentences(fwS.text, 2, (s) => s.length < 40).join(" ")), 340) : "";

  return {
    stage,
    shortTitle: shortTitleOf(title),
    background,
    objective,
    researchQuestions,
    hypotheses,
    methods,
    keyNumbers,
    findings,
    conclusion,
    implications,
    limitations,
    significance,
    framework: {
      layout,
      title: fwHeading && fwHeading.length <= 60 && layout !== "none" ? fwHeading : defaultFrameworkTitle(layout),
      theories,
      constructs,
      relationships,
      narrative: layout === "none" ? "" : narrative,
    },
  };
}

// ─── Generation + cache ────────────────────────────────────────────────────

const MAX_BODY_CHARS = 48000;

function sourceHash(src: ResearchSource, bodyText: string): string {
  return createHash("sha256")
    .update(`${RESEARCH_VISUALS_VERSION}\n${src.title}\n${src.abstract}\n${src.keywords}\n${bodyText}`)
    .digest("hex")
    .slice(0, 24);
}

const memo = new Map<string, Promise<ResearchVisualContent>>();
const EXTRACTIVE_TTL_MS = 6 * 60 * 60 * 1000;

export async function generateResearchVisualContent(src: ResearchSource): Promise<ResearchVisualContent> {
  const bodyText = src.bodyHtml ? bodyHtmlToText(src.bodyHtml) : "";
  const sourceText = `${src.title}\n${src.abstract}\n${src.keywords}\n${bodyText}`;
  const generatedAt = new Date().toISOString();
  const extractive = extractiveContent(src, bodyText);
  const detected = detectStage(splitBodySections(src.bodyHtml), src.abstract);
  if (anyLLMAvailable()) {
    try {
      const body = bodyText.length > MAX_BODY_CHARS ? `${bodyText.slice(0, MAX_BODY_CHARS)}\n[…body truncated…]` : bodyText;
      const { data, model } = await chatJSON<any>(
        SYSTEM_PROMPT,
        `Discipline: ${src.discipline || "(not stated)"}\nKeywords: ${src.keywords || "(none)"}\n\nTitle: ${src.title}\n\nAbstract:\n${src.abstract}\n\nFull text:\n${body || "(full text not available — use the abstract only)"}`,
        { maxTokens: 3500, temperature: 0.1 }
      );
      const clean = sanitizeExtraction(data, sourceText, src.title);
      // The article's own structure decides whether it reports results: an
      // outline manuscript never gets findings, whatever the model returned.
      if (detected === "proposal") {
        clean.stage = "proposal";
        clean.findings = [];
        clean.conclusion = "";
      }
      if (!clean.hypotheses.length) clean.hypotheses = extractive.hypotheses;
      if (!clean.researchQuestions.length) clean.researchQuestions = extractive.researchQuestions;
      if (!clean.significance) clean.significance = extractive.significance;
      // An empty LLM answer is worse than the extractive one.
      if (clean.findings.length || clean.objective || clean.researchQuestions.length) {
        return { version: RESEARCH_VISUALS_VERSION, mode: "llm", model, generatedAt, ...clean };
      }
    } catch (e) {
      console.error(`[research-visuals] LLM extraction failed for ${src.id}, using extractive fallback:`, e);
    }
  }
  return { version: RESEARCH_VISUALS_VERSION, mode: "extractive", model: "extractive", generatedAt, ...extractive };
}

/**
 * Cached content for an article. Storage key changes with the article text,
 * so an edited/re-published article is re-analysed automatically. An
 * extractive (no-LLM) result is cached for a few hours only, so downloads
 * stay fast while the LLM is unavailable and upgrade once it is back.
 */
export async function getResearchVisualContent(src: ResearchSource): Promise<ResearchVisualContent> {
  const bodyText = src.bodyHtml ? bodyHtmlToText(src.bodyHtml) : "";
  const key = `research-visuals/${src.id}/${sourceHash(src, bodyText)}.json`;
  const pending = memo.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const cached = await getObject(key);
      if (cached) {
        const parsed = JSON.parse(cached.toString("utf-8")) as ResearchVisualContent;
        const fresh = parsed?.mode === "llm" || !anyLLMAvailable() || Date.now() - Date.parse(parsed?.generatedAt ?? "") < EXTRACTIVE_TTL_MS;
        if (parsed?.version === RESEARCH_VISUALS_VERSION && fresh) return parsed;
      }
    } catch {
      // cache miss / storage unavailable — generate below
    }
    const content = await generateResearchVisualContent(src);
    await putObject(key, Buffer.from(JSON.stringify(content), "utf-8"), "application/json").catch((e) =>
      console.error("[research-visuals] cache write failed", e)
    );
    return content;
  })();
  memo.set(key, p);
  // Only an LLM result stays memoised in-process; an extractive one is
  // re-checked against storage (and its TTL) next time.
  p.then((c) => c.mode !== "llm" && memo.delete(key), () => memo.delete(key));
  if (memo.size > 200) memo.delete(memo.keys().next().value as string);
  return p;
}
