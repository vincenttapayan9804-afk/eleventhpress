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

export const RESEARCH_VISUALS_VERSION = 1;

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
  /** Short title for tight layouts (graphical abstract), ≤ 12 words. */
  shortTitle: string;
  background: string;
  objective: string;
  researchQuestions: string[];
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

Respond with a single JSON object, no markdown:
{
 "shortTitle": "<the article title shortened to at most 12 words, same meaning>",
 "background": "<the problem/context, 1-2 sentences, ≤ 45 words>",
 "objective": "<the aim, 1 sentence, ≤ 35 words>",
 "researchQuestions": ["<research question or hypothesis as stated>", "... at most 4"],
 "methods": {"design": "<≤ 14 words>", "participants": "<sample and size, ≤ 14 words>", "setting": "<where/when, ≤ 14 words>", "instruments": "<data collection tools, ≤ 14 words>", "analysis": "<analysis techniques, ≤ 14 words>"},
 "keyNumbers": [{"value": "<number exactly as written, e.g. 68.4% or n = 312 or r = .62>", "label": "<what it measures, ≤ 9 words>"}],
 "findings": ["<key finding, ≤ 28 words>", "... 3 to 5"],
 "conclusion": "<the main conclusion, ≤ 40 words>",
 "implications": ["<practical/theoretical implication or recommendation, ≤ 22 words>", "... 2 to 4"],
 "limitations": ["<limitation, ≤ 20 words>", "... at most 3"],
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

  const findings = strArr(raw?.findings, 5, 220);
  return {
    shortTitle: str(raw?.shortTitle, 110) || clip(title, 110),
    background: str(raw?.background, 330),
    objective: str(raw?.objective, 260),
    researchQuestions: strArr(raw?.researchQuestions, 4, 200),
    methods: {
      design: str(m.design, 110),
      participants: str(m.participants, 110),
      setting: str(m.setting, 110),
      instruments: str(m.instruments, 110),
      analysis: str(m.analysis, 110),
    },
    keyNumbers,
    findings,
    conclusion: str(raw?.conclusion, 300),
    implications: strArr(raw?.implications, 4, 170),
    limitations: strArr(raw?.limitations, 3, 160),
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
  for (const sent of sentences(text)) {
    const l = sent.toLowerCase();
    if (!s.objective && /\b(aim(s|ed)?|purpose|objective|this (study|paper|research) (examines|investigates|explores|assesses|determines|analy[sz]es)|we (examine|investigate|explore|assess))\b/.test(l)) s.objective = sent;
    else if (/\b(survey|questionnaire|interview|participants|respondents|sample|sampling|design|regression|anova|qualitative|quantitative|mixed[- ]method|thematic|descriptive|correlational|experimental)\b/.test(l) && s.methods.length < 400) s.methods += ` ${sent}`;
    else if (/\b(conclude|in conclusion|overall|implications?|recommend|suggests? that|should)\b/.test(l) && !s.conclusion) s.conclusion = sent;
    else if (/\b(found|results?|revealed|showed|shows|indicate[sd]?|significant(ly)?|findings?|demonstrat)/.test(l)) s.results += ` ${sent}`;
    else if (!s.background) s.background = sent;
  }
  return s;
}

const NUMBER_RE = /(\b[nN]\s*=\s*\d[\d,]*|\b[rRpβbt]\s*[=<>]\s*-?\.?\d+(?:\.\d+)?|\bR²?\s*=\s*\.?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\b\d{2,}(?:,\d{3})*\s+(?:participants|respondents|students|teachers|patients|schools|households|articles|studies|firms|items))/g;

export function extractKeyNumbers(text: string, max = 4): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const sent of sentences(text)) {
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

const THEORY_RE = /\b((?:[A-Z][\w'’-]+\s+){0,4}(?:[A-Z][\w'’-]+))(?:'s)?\s+(Theory|Model|Framework|Paradigm|Hierarchy of Needs|Taxonomy)\b|\b(?:theory|model) of ((?:[A-Z][\w'’-]+\s*){1,4})/g;

export function extractTheories(text: string): { name: string; note: string }[] {
  const out: { name: string; note: string }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(THEORY_RE)) {
    const name = squash(m[1] ? `${m[1]} ${m[2]}` : `Theory of ${m[3]}`).replace(/^(The|This|Our|A|An|In|Using|Under)\s+/, "");
    if (name.split(" ").length < 2) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, note: "" });
    if (out.length >= 4) break;
  }
  return out;
}

export function extractiveContent(src: ResearchSource, bodyText: string): Omit<ResearchVisualContent, "version" | "mode" | "model" | "generatedAt"> {
  const s = abstractSections(src.abstract);
  const firstSentences = (t: string, n: number) => sentences(t).slice(0, n);
  const findings = firstSentences(s.results, 4).map((f) => clip(f, 220));
  const theories = extractTheories(`${src.abstract}\n${bodyText.slice(0, 40000)}`);
  return {
    shortTitle: clip(src.title, 110),
    background: clip(firstSentences(s.background, 2).join(" "), 330),
    objective: clip(s.objective, 260),
    researchQuestions: [],
    methods: { design: clip(s.methods, 110), participants: "", setting: "", instruments: "", analysis: "" },
    keyNumbers: extractKeyNumbers(`${s.results} ${s.methods} ${src.abstract}`),
    findings: findings.length ? findings : firstSentences(src.laySummary ?? "", 3).map((f) => clip(f, 220)),
    conclusion: clip(s.conclusion, 300),
    implications: firstSentences(s.implications, 3).map((f) => clip(f, 170)),
    limitations: firstSentences(s.limitations, 2).map((f) => clip(f, 160)),
    framework: {
      layout: theories.length ? "theory" : "none",
      title: "Theoretical Framework",
      theories,
      constructs: [],
      relationships: [],
      narrative: "",
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

export async function generateResearchVisualContent(src: ResearchSource): Promise<ResearchVisualContent> {
  const bodyText = src.bodyHtml ? bodyHtmlToText(src.bodyHtml) : "";
  const sourceText = `${src.title}\n${src.abstract}\n${src.keywords}\n${bodyText}`;
  const generatedAt = new Date().toISOString();
  if (anyLLMAvailable()) {
    try {
      const body = bodyText.length > MAX_BODY_CHARS ? `${bodyText.slice(0, MAX_BODY_CHARS)}\n[…body truncated…]` : bodyText;
      const { data, model } = await chatJSON<any>(
        SYSTEM_PROMPT,
        `Discipline: ${src.discipline || "(not stated)"}\nKeywords: ${src.keywords || "(none)"}\n\nTitle: ${src.title}\n\nAbstract:\n${src.abstract}\n\nFull text:\n${body || "(full text not available — use the abstract only)"}`,
        { maxTokens: 3500, temperature: 0.1 }
      );
      const clean = sanitizeExtraction(data, sourceText, src.title);
      // An empty LLM answer is worse than the extractive one.
      if (clean.findings.length || clean.objective) {
        return { version: RESEARCH_VISUALS_VERSION, mode: "llm", model, generatedAt, ...clean };
      }
    } catch (e) {
      console.error(`[research-visuals] LLM extraction failed for ${src.id}, using extractive fallback:`, e);
    }
  }
  return { version: RESEARCH_VISUALS_VERSION, mode: "extractive", model: "extractive", generatedAt, ...extractiveContent(src, bodyText) };
}

/**
 * Cached content for an article. Storage key changes with the article text,
 * so an edited/re-published article is re-analysed automatically. An
 * extractive (no-LLM) result is not cached, so it upgrades once an LLM is
 * configured.
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
        if (parsed?.version === RESEARCH_VISUALS_VERSION) return parsed;
      }
    } catch {
      // cache miss / storage unavailable — generate below
    }
    const content = await generateResearchVisualContent(src);
    if (content.mode === "llm") {
      await putObject(key, Buffer.from(JSON.stringify(content), "utf-8"), "application/json").catch((e) =>
        console.error("[research-visuals] cache write failed", e)
      );
    }
    return content;
  })();
  memo.set(key, p);
  // Only an LLM result stays memoised; an extractive one retries next time.
  p.then((c) => c.mode !== "llm" && memo.delete(key), () => memo.delete(key));
  if (memo.size > 200) memo.delete(memo.keys().next().value as string);
  return p;
}
