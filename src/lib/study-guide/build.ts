/**
 * The content of an article's Researcher's Study Guide: the interactive
 * HTML document (src/lib/study-guide/render.ts) offered with every
 * published article's galleys.
 *
 * Everything in it comes from the article:
 *
 * - Study notes: the article's own sections and paragraphs (the manuscript
 *   text is shown verbatim), each with a plain-language "what it says", a
 *   "why it's there · how to present it" note and likely study questions.
 * - Big picture: a 60-second summary, the study's model (its framework,
 *   variables or Input-Process-Output paradigm), the research questions →
 *   method → finding table and how the manuscript is built.
 * - Presentation notes, flashcards, key numbers, glossary and sources
 *   (with where each reference is cited).
 *
 * An extractive pass builds the whole guide from the text alone, so a guide
 * always exists. When an LLM is configured it rewrites the explanatory parts
 * (gists, roles, overviews, answers, slide notes, number and term
 * descriptions); anything it returns that is not grounded in the article —
 * a number that does not appear in the source, a term the article never
 * uses — is dropped in favour of the extractive text.
 */
import { createHash } from "node:crypto";
import { anyLLMAvailable, chatJSON } from "@/lib/llm";
import { getObject, putObject } from "@/lib/storage";
import {
  clip,
  displayCase,
  numberGroundedIn,
  sentences,
  squash,
  stripCitations,
  type ResearchVisualContent,
  type SectionKey,
} from "@/lib/research-visuals";
import { buildOutline, type Outline, type OutlineSection } from "@/lib/study-guide/outline";

/**
 * Bump whenever the guide's content or layout changes: stored guides are
 * keyed by it, so every published article's guide is rebuilt on its next
 * download (and by the daily sweep).
 */
export const STUDY_GUIDE_VERSION = 3;

export interface GuidePara {
  label: string;
  gist: string;
  role: string;
  orig: string;
}

export interface GuideSection {
  id: string;
  ch: number;
  title: string;
  /** "Slide 4", "Slides 6–7" or "Not a slide …". */
  slides: string;
  overview: string;
  paras: GuidePara[];
  qa: { q: string; a: string }[];
}

export interface GuideModelColumn {
  label: string;
  items: string[];
}

export interface StudyGuideData {
  version: number;
  mode: "llm" | "extractive";
  model: string;
  generatedAt: string;
  chapters: Record<number, string>;
  sections: GuideSection[];
  numbers: { v: string; t: string }[];
  glossary: { term: string; def_: string }[];
  elevator: string[];
  refs: { text: string; key: string; where: string[] }[];
  slides: { n: number; title: string; note: string }[];
  big: {
    modelTitle: string;
    /** Three columns (inputs → process → outputs, or IVs → DV …). */
    model: GuideModelColumn[];
    modelFeedback: string;
    modelNote: string;
    tableTitle: string;
    tableHead: [string, string, string, string];
    rows: [string, string, string, string][];
    cards: { h: string; p: string }[];
  };
  /** "≈ 20 minutes overall". */
  pace: string;
  chips: string[];
}

export interface StudyGuideSource {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  discipline: string;
  authors: { name: string; affiliation?: string }[];
  bodyHtml: string | null;
  /** The article's reference list (from the reference checker), if any. */
  references: string[];
  /** The research-visual analysis of the same article (framework, RQs, methods …). */
  content: ResearchVisualContent;
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function slug(s: string, used: Set<string>): string {
  const base =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "section";
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  used.add(id);
  return id;
}

function plain(s: string): string {
  return squash(stripCitations(s));
}

function firstN(text: string, n: number, max: number): string {
  const s = sentences(plain(text)).slice(0, n).join(" ");
  return clip(s || plain(text), max);
}

function pick(text: string, re: RegExp, n: number, max: number): string {
  const hits = sentences(plain(text)).filter((s) => re.test(s));
  return hits.length ? clip(hits.slice(0, n).join(" "), max) : "";
}

function capFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function sectionText(s: OutlineSection): string {
  return s.paras.map((p) => p.text).join("\n");
}

const CONNECTIVE = /^(in addition|additionally|moreover|furthermore|however|likewise|similarly|also|thus|hence|therefore|consequently|meanwhile|on the other hand|in this (study|research|regard|context)|as such|for (this|these) reasons?|in (particular|general)|specifically|overall|notably|indeed|lastly|finally|first(ly)?|second(ly)?|third(ly)?),?\s+/i;
const LABEL_STOP = /\b(is|are|was|were|will|would|can|could|should|has|have|had|refers?|includes?|involves?|shows?|showed|indicates?|suggests?|found|aims?|seeks?|focus(es)?|plays?|provides?|serves?|means|describes?|explains?|examines?|explores?|highlights?)\b/i;

/** A short card title for a paragraph without its own sub-heading. */
function deriveLabel(text: string, fallback: string): string {
  const s = sentences(plain(text))[0] ?? plain(text);
  const words = s.replace(CONNECTIVE, "").replace(/^(the|this|these|that|a|an)\s+/i, "").split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    if (out.length >= 2 && LABEL_STOP.test(w)) break;
    if (/[,;:]$/.test(w)) {
      out.push(w.replace(/[,;:]$/, ""));
      if (out.length >= 2) break;
      continue;
    }
    out.push(w);
    if (out.length >= 7) break;
  }
  const label = out.join(" ").replace(/[.()“”"']/g, "").trim();
  return label.length >= 6 ? capFirst(label) : fallback;
}

// ─── Section roles and questions (extractive) ──────────────────────────────

const ROLE: Partial<Record<SectionKey, string>> = {
  background: "Builds the case for the study: the context, the trend and the gap it responds to. Present it as the reason the study is needed.",
  purpose: "States what the study sets out to do. Say it in one breath; every later section should trace back to it.",
  problem: "Lists the questions the study must answer. Each one maps to a result (or, in a proposal, to a planned analysis).",
  hypotheses: "States the claims the study tests statistically. Be ready to say how each is accepted or rejected.",
  framework: "Names the theory and the variables or constructs, and how they connect. This is the logic the methods test.",
  significance: "Explains who benefits and how. Useful for closing remarks and 'so what?' questions.",
  scope: "Draws the boundaries: who, where, when and what is not covered. Stating it early heads off questions about what is not covered.",
  literature: "Shows what earlier studies found and where they fall short. Use it to justify the variables and the gap.",
  definitions: "Fixes how key terms are used in this study. Define on request, in the study's own words.",
  design: "Names the research design and why it fits the questions. Expect 'why this design and not another?'.",
  participants: "Says who took part, how many and how they were chosen. Expect questions on sampling and inclusion.",
  setting: "Describes where the study took place and why that locale suits it.",
  instruments: "Describes how data were collected and why the instruments are valid and reliable.",
  procedure: "Walks through the data-gathering steps in order, from permission to retrieval.",
  analysis: "Matches each question to the statistical or analytic tool that answers it.",
  results: "Reports what the data showed. Quote the numbers exactly as written.",
  discussion: "Interprets the results against earlier studies and the framework.",
  conclusion: "Answers the research questions in plain terms. Keep it to what the data support.",
  recommendations: "Turns the findings into actions for specific readers or institutions.",
  limitations: "Admits what the study cannot claim. Saying it first shows rigour.",
  ethics: "Shows how participants were protected: consent, privacy, risk and data security.",
};

const CITE_RE = /\(([A-Z][A-Za-z'’\-]+)(?: et al\.)?(?:,| &| and)[^()]*?((?:19|20)\d{2})[a-z]?\)|\b([A-Z][A-Za-z'’\-]+)(?: et al\.)? \(((?:19|20)\d{2})[a-z]?\)/;
const HAS_NUMBER = /\b\d+(?:\.\d+)?\s?%|\b[nN]\s*=\s*\d|\b\d{2,}\s+(respondents|participants|informants|students|teachers|schools|items)\b/;

function roleFor(section: OutlineSection, i: number, text: string): string {
  const base = (section.key && ROLE[section.key]) || "";
  const bits: string[] = [];
  if (i === 0) bits.push(base || `Opens "${section.heading}" and sets up its main point.`);
  else if (i === section.paras.length - 1 && section.paras.length > 2) bits.push("Closes the section and leads into what follows.");
  else bits.push(i === 1 && base ? "Develops the section's main point with detail." : "Adds supporting detail to the section's argument.");
  const cite = text.match(CITE_RE);
  if (cite) bits.push(`Backed by ${cite[1] ?? cite[3]} (${cite[2] ?? cite[4]}); be ready to name the source.`);
  else if (HAS_NUMBER.test(text)) bits.push("Contains figures worth remembering exactly.");
  return bits.join(" ");
}

interface QATemplate {
  q: string;
  re: RegExp;
}

const QA: Partial<Record<SectionKey, QATemplate[]>> = {
  background: [
    { q: "Why is this study needed?", re: /\b(gap|lack|limited|few|scarce|little|problem|challenge|concern|need|issue|declin|low)\w*/i },
    { q: "What is the context of the study?", re: /\b(country|region|province|city|school|institution|sector|global|national|local|philippines|department)\b/i },
  ],
  purpose: [{ q: "What is the purpose of the study?", re: /\b(aim|purpose|objective|seek|sought|intend|investigat|explor|determin|examin)\w*/i }],
  problem: [{ q: "What questions does the study answer?", re: /\?|\b(what|whether|is there|how)\b/i }],
  hypotheses: [{ q: "What hypotheses are tested, and at what level of significance?", re: /\b(hypothes|no significant|significan|level)\w*/i }],
  framework: [
    { q: "Which theory anchors the study, and why?", re: /\b(theory|theories|model|framework|anchored|grounded|posits?|according to)\b/i },
    { q: "How are the variables related in the framework?", re: /\b(independent|dependent|variable|mediat|moderat|predict|influence|relationship|construct)\w*/i },
  ],
  literature: [{ q: "What does the literature say, and what gap remains?", re: /\b(found|reveal|show|suggest|indicat|however|gap|limited|few|lack)\w*/i }],
  significance: [{ q: "Who benefits from the study, and how?", re: /\b(benefit|help|useful|guide|inform|contribut|serve|valuable|significan)\w*/i }],
  scope: [{ q: "What does the study cover, and what does it leave out?", re: /\b(cover|limit|delimit|focus|only|exclude|scope|restricted)\w*/i }],
  definitions: [{ q: "How are the key terms defined in this study?", re: /\b(refers? to|defined|is the|are the|means)\b/i }],
  design: [{ q: "Why is this research design appropriate?", re: /\b(design|approach|appropriate|suitable|because|since|allows?|enables?|method)\w*/i }],
  participants: [{ q: "Who are the respondents, and how were they selected?", re: /\b(respondents?|participants?|informants?|sample|sampling|select|chosen|random|purposive|criteria|inclusion)\w*/i }],
  setting: [{ q: "Where was the study conducted, and why there?", re: /\b(located|conducted|locale|setting|province|city|municipality|school|campus)\b/i }],
  instruments: [{ q: "How valid and reliable are the instruments?", re: /\b(valid|reliab|cronbach|alpha|pilot|expert|adapted|adopted|likert|scale|questionnaire|interview guide)\w*/i }],
  procedure: [{ q: "How were the data gathered?", re: /\b(permission|consent|administer|distribut|retriev|collect|gather|interview|letter|approval)\w*/i }],
  analysis: [{ q: "Which tools are used to analyse the data, and for what?", re: /\b(mean|standard deviation|pearson|regression|anova|t-test|chi|thematic|coding|correlation|frequency|percentage|analysis|spss)\w*/i }],
  results: [{ q: "What is the main finding?", re: /\b(found|reveal|show|indicat|result|significan|highest|lowest|mean|level)\w*/i }],
  discussion: [{ q: "How do the findings compare with earlier studies?", re: /\b(consistent|support|agree|align|contrary|contrast|similar|earlier|previous|confirm)\w*/i }],
  conclusion: [{ q: "What does the study conclude?", re: /\b(conclude|therefore|thus|overall|in summary|findings)\w*/i }],
  recommendations: [{ q: "What does the study recommend, and to whom?", re: /\b(recommend|should|may|encouraged|suggest)\w*/i }],
  limitations: [{ q: "What are the limitations of the study?", re: /\b(limit|only|cannot|small|single|self-report|generaliz)\w*/i }],
  ethics: [{ q: "How were the participants protected?", re: /\b(consent|confidential|privacy|anonym|risk|voluntary|withdraw|data privacy|ethics)\w*/i }],
};

function extractiveQA(s: OutlineSection, content: ResearchVisualContent): { q: string; a: string }[] {
  const text = sectionText(s);
  const out: { q: string; a: string }[] = [];
  if (s.key === "problem" && content.researchQuestions.length) {
    out.push({ q: "What questions does the study answer?", a: clip(content.researchQuestions.map((q, i) => `(${i + 1}) ${q}`).join(" "), 600) });
  } else if (s.key === "hypotheses" && content.hypotheses.length) {
    out.push({ q: "What hypotheses are tested?", a: clip(content.hypotheses.join(" "), 600) });
  } else if (s.key === "purpose" && content.objective) {
    out.push({ q: "What is the purpose of the study?", a: clip(content.objective, 420) });
  }
  for (const t of (s.key && QA[s.key]) || []) {
    if (out.some((x) => x.q === t.q)) continue;
    const a = pick(text, t.re, 2, 420);
    if (a) out.push({ q: t.q, a });
  }
  if (s.key === "definitions") {
    for (const p of s.paras.filter((p) => p.label).slice(0, 2)) out.push({ q: `How is "${p.label}" defined in this study?`, a: firstN(p.text, 2, 380) });
  }
  if (!out.length) {
    const a = firstN(text, 2, 380);
    if (a) out.push({ q: `What is the key point of "${s.heading}"?`, a });
  }
  return out.slice(0, 3);
}

// ─── Key numbers ───────────────────────────────────────────────────────────

const NUM_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s?%/g,
  /\b(?:[nN]|[rR]|[pP]|[tT]|[fF]|β|[Mm]ean|SD|α|alpha|R²|R2)\s*[=<>≤≥]\s*-?\.?\d+(?:[.,]\d+)?/g,
  /\b\d[\d,]*\s+(?:respondents|participants|informants|students|teachers|pupils|employees|schools|institutions|campuses|programs|items|questions|statements|indicators|constructs|records|graduates|households|patients|nurses|farmers|articles|studies|years|months|weeks|sessions|phases|stages|steps|experts|interviews)\b/gi,
  /\b(?:five|four|seven|three|six|5|4|7|3|6)-point\b/gi,
  /\b(?:0?\.\d{2,3})\b(?=[^.]{0,40}\b(?:cronbach|alpha|reliab|coefficient|level of significance|significance)\b)|(?<=\b(?:cronbach'?s? alpha|alpha|reliability|coefficient|significance)[^.]{0,30})\b0?\.\d{2,3}\b/gi,
  /\b(?:19|20)\d{2}\b(?=[^.]{0,6}\b(?:to|–|-)\b)|(?<=\b(?:founded|established|since|created|enacted|signed|approved|launched|adopted)\b[^.]{0,12})\b(?:19|20)\d{2}\b/gi,
];

function contextFor(sentence: string, value: string): string {
  let s = sentence.replace(/\s+/g, " ").trim().replace(/[.;:]$/, "");
  if (s.length <= 130) return capFirst(s);
  const at = s.indexOf(value);
  const start = Math.max(0, Math.min(at - 55, s.length - 130));
  let w = s.slice(start, start + 130);
  if (start > 0) w = "…" + w.slice(w.indexOf(" ") + 1);
  if (start + 130 < s.length) w = w.slice(0, w.lastIndexOf(" ")) + "…";
  return capFirst(w);
}

export function extractNumbers(sections: OutlineSection[], max = 40): { v: string; t: string; section: string }[] {
  const out: { v: string; t: string; section: string }[] = [];
  const seen = new Set<string>();
  // Methods and results first: those are the numbers most worth knowing.
  const order = [...sections].sort((a, b) => rank(a.key) - rank(b.key));
  for (const s of order) {
    for (const p of s.paras) {
      for (const sent of sentences(plain(p.text))) {
        for (const re of NUM_PATTERNS) {
          re.lastIndex = 0;
          for (const m of sent.matchAll(re)) {
            const v = m[0].replace(/\s+/g, " ").trim();
            const k = `${v.toLowerCase()}|${sent.slice(0, 40)}`;
            if (seen.has(k) || [...seen].some((x) => x.startsWith(`${v.toLowerCase()}|`))) continue;
            seen.add(k);
            out.push({ v, t: contextFor(sent, v), section: s.heading });
            if (out.length >= max) return out;
          }
        }
      }
    }
  }
  return out;
}

function rank(key: SectionKey | null): number {
  const order: (SectionKey | null)[] = ["participants", "instruments", "analysis", "results", "design", "hypotheses", "setting", "procedure", "background", "purpose", "problem", "framework", "significance", "scope", "discussion", "conclusion", "recommendations", "limitations", "literature", "definitions", "ethics"];
  const i = order.indexOf(key);
  return i < 0 ? 50 : i;
}

// ─── Glossary ──────────────────────────────────────────────────────────────

const SMALL = new Set(["of", "and", "for", "the", "in", "on", "to", "&", "a", "an", "with", "at", "by"]);

export function extractGlossary(sections: OutlineSection[], keywords: string, max = 60): { term: string; def_: string }[] {
  const out: { term: string; def_: string }[] = [];
  const have = (t: string) => out.some((g) => g.term.toLowerCase() === t.toLowerCase());
  const all = sections.map(sectionText).join("\n");

  // 1. Operational definitions as the article states them.
  for (const s of sections.filter((s) => s.key === "definitions")) {
    for (const p of s.paras) {
      const term = p.label || (p.text.match(/^([A-Z][^.:–—]{2,60})[.:–—]\s/)?.[1] ?? "");
      if (!term || have(term)) continue;
      const body = p.text.startsWith(term) ? p.text.slice(term.length).replace(/^[\s.:–—-]+/, "") : p.text;
      out.push({ term: displayCase(term), def_: firstN(body, 2, 320) });
    }
  }

  // 2. Acronyms: "Decision Support System (DSS)".
  const acr = /\(([A-Z][A-Za-z0-9&\-]{1,11})\)/g;
  for (const s of sections) {
    for (const p of s.paras) {
      const text = p.text;
      for (const m of text.matchAll(acr)) {
        const abbr = m[1];
        const caps = abbr.replace(/[^A-Z]/g, "");
        if (caps.length < 2 || /^(19|20)\d\d/.test(abbr) || have(abbr)) continue;
        const before = text.slice(Math.max(0, (m.index ?? 0) - 160), m.index).replace(/[“”"]/g, "").trim().split(/\s+/);
        // Walk back until the content words' initials cover the acronym.
        const words: string[] = [];
        let content = 0;
        for (let i = before.length - 1; i >= 0 && content < caps.length + 1; i--) {
          const w = before[i].replace(/[,;:]$/, "");
          if (/[.;:]$/.test(before[i]) && words.length) break;
          words.unshift(w);
          if (!SMALL.has(w.toLowerCase())) content++;
          if (content === caps.length) break;
        }
        while (words.length && SMALL.has(words[0].toLowerCase())) words.shift();
        const initials = words.filter((w) => !SMALL.has(w.toLowerCase())).map((w) => w[0]?.toUpperCase()).join("");
        if (!words.length || initials[0] !== caps[0]) continue;
        const long = words.join(" ");
        const sent = sentences(plain(text)).find((x) => x.includes(abbr)) ?? "";
        const extra = sent && sent.length < 260 && !sent.startsWith(long) ? ` ${clip(sent, 220)}` : "";
        out.push({ term: abbr, def_: `${displayCase(long)}.${extra}` });
        if (out.length >= max) return out;
      }
    }
  }

  // 3. Keywords and framework variables, defined by the article's own sentence.
  const candidates = [
    ...keywords.split(/[;,]/).map((k) => k.trim()).filter((k) => k.length > 2),
    ...sections.filter((s) => s.key === "framework" || s.key === "literature").flatMap((s) => s.paras.map((p) => p.label).filter(Boolean)),
  ];
  for (const term of candidates) {
    if (have(term) || out.length >= max) continue;
    // Only a sentence that defines the term ("X is …", "X refers to …") near its start.
    const re = new RegExp(`^(?:\\S+\\s+){0,3}${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.]{0,30}?\\b(is (?:defined as|a|an|the)|are (?:defined as|the)|refers? to|means|pertains to|is described as)\\b`, "i");
    const sent = sentences(plain(all)).find((x) => re.test(x));
    if (sent) out.push({ term: displayCase(term), def_: clip(sent, 300) });
  }
  return out.slice(0, max);
}

// ─── References ────────────────────────────────────────────────────────────

function refKey(text: string): { key: string; surname: string; year: string } | null {
  const m = text.match(/^\s*([^,(.]{2,40}?)(?:,|\.|\s\()[\s\S]{0,200}?\(?((?:19|20)\d{2}[a-z]?|n\.d\.)\)?/);
  if (!m) return null;
  const surname = m[1].replace(/^(the|a)\s+/i, "").trim();
  if (!/[A-Za-z]/.test(surname)) return null;
  return { key: `${surname} (${m[2]})`, surname, year: m[2].replace(/[a-z]$/, "") };
}

export function buildRefs(refs: string[], sections: GuideSection[]): { text: string; key: string; where: string[] }[] {
  // Only real reference entries (they carry a year or "n.d."); a stray
  // "Keywords: …" line after the list is not a source.
  return refs.filter((r) => /\b(19|20)\d{2}[a-z]?\b|\bn\.d\./.test(r) && !/^\s*(keywords?|discipline|subjects?)\s*:/i.test(r)).slice(0, 400).map((raw) => {
    const text = squash(raw).replace(/^\[?\d+[\].]\s*/, "");
    const k = refKey(text);
    if (!k) return { text, key: "", where: [] };
    // "Alam and Mohanty (2024)", "(Alam & Mohanty, 2024)", "Åsebø et al. (2022)": the surname, then the year within the same citation.
    const name = k.surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const near = new RegExp(`(?<!\\p{L})${name}(?!\\p{L})[^;]{0,90}?\\b${k.year}\\b`, "iu");
    const where = sections.filter((s) => s.paras.some((p) => near.test(p.orig))).map((s) => s.title);
    return { text, key: k.key, where: [...new Set(where)].slice(0, 6) };
  });
}

// ─── Big picture ───────────────────────────────────────────────────────────

const ANALYSIS_FOR: [RegExp, string][] = [
  [/\b(relationship|correlat|associat)\w*/i, "Pearson r / correlation"],
  [/\b(influence|predict|effect|impact|determin)\w*/i, "Regression analysis"],
  [/\b(difference|differ|compare|comparison)\w*/i, "t-test / ANOVA"],
  [/\b(level|extent|status|profile|degree)\b/i, "Mean and standard deviation"],
  [/\b(experience|perception|insight|lived|challenge|cope|coping|meaning)\w*/i, "Thematic analysis"],
  [/\b(mediat)\w*/i, "Mediation analysis"],
  [/\b(moderat)\w*/i, "Moderation analysis"],
];

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["what", "there", "which", "their", "level", "study", "this", "that", "with", "among", "between", "significant"].includes(w))
  );
}

function overlap(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return A.size ? n / A.size : 0;
}

function shortHeading(t: string): string {
  return t.replace(/^(\d+(\.\d+)*\.?|[IVX]+\.)\s+/, "").replace(/\b(of the study|of the research)\b/gi, "").replace(/\s+/g, " ").trim();
}

function bigPicture(src: StudyGuideSource, outline: Outline, sections: GuideSection[]): StudyGuideData["big"] {
  const c = src.content;
  const fw = c.framework;
  const byRole = (roles: string[]) => fw.constructs.filter((k) => roles.includes(k.role)).map((k) => k.label);
  let model: GuideModelColumn[];
  let modelTitle = fw.title || "Study model";
  if (fw.layout === "ipo" && fw.constructs.length) {
    model = [
      { label: "INPUTS", items: byRole(["input"]) },
      { label: "PROCESS", items: byRole(["process"]) },
      { label: "OUTPUTS", items: byRole(["output"]) },
    ];
  } else if (fw.layout === "variables" && fw.constructs.length) {
    const mids = byRole(["mediator", "moderator"]);
    model = [
      { label: "INDEPENDENT", items: byRole(["independent", "input", "control"]) },
      { label: mids.length ? "MEDIATING / MODERATING" : "RELATIONSHIP TESTED", items: mids.length ? mids : fw.relationships.map((r) => r.label).filter(Boolean).slice(0, 5) },
      { label: "DEPENDENT", items: byRole(["dependent", "output"]) },
    ];
    if (!model[1].items.length) model[1].items = [c.methods.analysis ? clip(c.methods.analysis, 60) : "Relationship / influence"];
  } else {
    modelTitle = "The study at a glance (inputs → process → outputs)";
    model = [
      { label: "INPUTS", items: [c.methods.participants, c.methods.setting, c.methods.instruments].filter(Boolean).map((x) => clip(x, 70)) },
      { label: "PROCESS", items: [c.methods.design, c.methods.analysis].filter(Boolean).map((x) => clip(x, 70)) },
      { label: "OUTPUTS", items: (c.stage === "results" ? c.findings : [c.objective]).filter(Boolean).slice(0, 3).map((x) => clip(x, 70)) },
    ];
  }
  model = model.map((col) => ({ label: col.label, items: (col.items.length ? col.items : ["—"]).slice(0, 5) }));
  const theories = fw.theories.map((t) => t.name).slice(0, 3);
  const modelNote = clip(
    [fw.narrative, c.methods.design ? `Research design: ${c.methods.design.replace(/[.;\s]+$/, "")}.` : "", theories.length ? `Anchored on ${joinList(theories)}.` : ""].filter(Boolean).join(" "),
    320
  );

  // Research questions → method → finding / expected outcome.
  const qs = c.researchQuestions.length ? c.researchQuestions : c.hypotheses.length ? c.hypotheses : c.objective ? [c.objective] : [];
  const prefix = c.researchQuestions.length ? "RQ" : c.hypotheses.length ? "H" : "Aim";
  const analysisText = `${c.methods.analysis} ${outline.sections.filter((s) => s.key === "analysis").map(sectionText).join(" ")}`.toLowerCase();
  const qualitative = /\b(qualitative|phenomenolog|thematic|case study|narrative inquiry|grounded theory|ethnograph)\w*/i.test(`${c.methods.design} ${c.methods.analysis}`);
  const stated = c.methods.analysis ? clip(c.methods.analysis, 60) : "As described in the methods";
  const rows: [string, string, string, string][] = qs.slice(0, 10).map((q, i) => {
    // A qualitative study answers every question with its own analysis (e.g. thematic analysis).
    const want = qualitative ? stated : ANALYSIS_FOR.find(([re]) => re.test(q))?.[1] ?? stated;
    // Prefer the article's own wording of the tool when it names one.
    const named = want.split(" / ").find((w) => analysisText.includes(w.split(" ")[0].toLowerCase()));
    const method = named ?? want;
    const best = c.findings.map((f) => ({ f, s: overlap(q, f) })).sort((a, b) => b.s - a.s)[0];
    const result = c.stage === "results" && best && best.s >= 0.25 ? clip(best.f, 200) : c.stage === "proposal" ? "To be answered when the data are analysed" : "See the results section";
    return [`${prefix}${qs.length > 1 || prefix !== "Aim" ? i + 1 : ""}`, clip(q, 220), method, result];
  });

  // How the manuscript is built.
  const cards: { h: string; p: string }[] = [];
  for (const [n, label] of Object.entries(outline.chapters)) {
    const titles = sections.filter((s) => s.ch === Number(n) && s.id !== "refs").map((s) => shortHeading(s.title));
    if (titles.length) cards.push({ h: `${label.split(" · ")[0]} logic`, p: `${titles.slice(0, 12).join(" → ")}.` });
  }
  const distinctive = c.significance || c.conclusion || c.implications[0] || "";
  if (distinctive) cards.push({ h: c.stage === "proposal" ? "Expected contribution" : "What it contributes", p: clip(distinctive, 360) });

  return {
    modelTitle,
    model,
    modelFeedback: fw.relationships.length ? `Relationships tested: ${clip(fw.relationships.map((r) => r.label || `${r.from} → ${r.to}`).filter(Boolean).join(" · "), 110)}` : "",
    modelNote,
    tableTitle: c.stage === "proposal" ? "Research questions → planned analysis → outcome" : "Research questions → method → finding",
    tableHead: ["Item", "What is examined", "Method", c.stage === "proposal" ? "Outcome" : "Finding"],
    rows,
    cards: cards.slice(0, 6),
  };
}

// ─── Extractive guide ──────────────────────────────────────────────────────

// ─── Point of view ─────────────────────────────────────────────────────────

/** Roman-numeral "I" (Chapter I, Type I error …) is not a pronoun. */
const ROMAN_I_BEFORE = /\b(chapter|phase|type|table|figure|fig\.|section|part|level|grade|article|stage|class|tier|appendix|model|book|volume|vol\.|world war|cycle|round|step|unit|study|experiment|trial|group|category)\s*$/i;

function withCase(match: string, out: string): string {
  return /^[A-Z]/.test(match) ? capFirst(out) : out;
}

/**
 * Rewrites first-person wording (I, me, my, we, us, our) into a general,
 * third-person point of view ("the researcher", "the researchers", "the
 * study"), so guide text never speaks as the author. Applied to everything
 * the guide writes; the manuscript's own text (shown verbatim) is untouched.
 */
export function neutralPov(text: string): string {
  if (!text || !/\b(I|me|my|we|us|our|ours)\b/i.test(text)) return text;
  // Quoted text (a title, a quoted line) and names such as "Our Lady of …" are kept as written.
  return text
    .split(/(“[^”]*”|"[^"]*"|\bOur Lady\b[^,;.]*)/)
    .map((part, k) => (k % 2 ? part : povPart(part)))
    .join("");
}

function povPart(text: string): string {
  const t = text
    .replace(/\b(our|my) (own )?(study|research|paper|thesis|dissertation|article|investigation|inquiry|findings?|results?|data|dataset|sample|respondents|participants|informants|analysis|framework|model|hypothes[ie]s|questionnaire|instrument|survey|method(?:s|ology)?|approach|objectives?|aims?|work|project|experiments?|review|team)\b/gi, (m, _p, _o, noun: string) => withCase(m, `the ${noun}`))
    .replace(/\bwe(?: are|['’]re)\b/gi, (m) => withCase(m, "the researchers are"))
    .replace(/\bwe['’]ve\b/gi, (m) => withCase(m, "the researchers have"))
    .replace(/\bwe\b/gi, (m) => withCase(m, "the researchers"))
    .replace(/\bours?\b/gi, (m) => withCase(m, "the researchers'"))
    .replace(/\bus\b/g, "the researchers")
    .replace(/\bmy\b/gi, (m) => withCase(m, "the researcher's"))
    .replace(/\bme\b/g, "the researcher");
  return t.replace(/\bI(?: am|['’]m)\b|\bI(?: have|['’]ve)\b|\bI\b(?=\s+[a-z])/g, (m: string, off: number, all: string) => {
    if (ROMAN_I_BEFORE.test(all.slice(0, off))) return m;
    const out = /m$/.test(m) ? "the researcher is" : /(ve|have)$/.test(m) ? "the researcher has" : "the researcher";
    return off === 0 || /[.!?:]["”)]?\s+$/.test(all.slice(0, off)) ? capFirst(out) : out;
  });
}

/** Every guide-written field in a general point of view (manuscript text and references stay verbatim). */
function neutralGuide(g: StudyGuideData): StudyGuideData {
  const n = neutralPov;
  for (const s of g.sections) {
    s.overview = n(s.overview);
    for (const p of s.paras) {
      p.gist = n(p.gist);
      p.role = n(p.role);
    }
    s.qa = s.qa.map((x) => ({ q: n(x.q), a: n(x.a) }));
  }
  g.elevator = g.elevator.map(n);
  g.slides = g.slides.map((x) => ({ ...x, title: n(x.title), note: n(x.note) }));
  g.numbers = g.numbers.map((x) => ({ ...x, t: n(x.t) }));
  g.glossary = g.glossary.map((x) => ({ ...x, def_: n(x.def_) }));
  g.big.modelNote = n(g.big.modelNote);
  g.big.rows = g.big.rows.map((r): [string, string, string, string] => [r[0], n(r[1]), n(r[2]), n(r[3])]);
  g.big.cards = g.big.cards.map((c) => ({ ...c, p: n(c.p) }));
  return g;
}

const NOT_A_SLIDE: Partial<Record<SectionKey, string>> = {
  literature: "Not a slide (be ready to discuss)",
  definitions: "Not a slide (define on request)",
  significance: "Not a slide",
  ethics: "",
};

export function buildExtractiveGuide(src: StudyGuideSource): StudyGuideData {
  const outline = buildOutline(src.bodyHtml, src.abstract);
  const c = src.content;
  const used = new Set<string>();
  const counters: Record<number, number> = {};

  // Sections and paragraphs.
  const sections: GuideSection[] = outline.sections.map((s) => {
    counters[s.ch] = (counters[s.ch] ?? 0) + 1;
    const numbered = /^(\d+(\.\d+)*|[IVX]+)[.)]?\s/.test(s.heading);
    const title = numbered || !outline.fullText ? s.heading : `${s.ch}.${counters[s.ch]} ${s.heading}`;
    const paras: GuidePara[] = s.paras.map((p, i) => ({
      label: p.label || deriveLabel(p.text, `Paragraph ${i + 1}`),
      gist: firstN(p.text, 2, 420),
      role: roleFor(s, i, p.text),
      orig: p.text,
    }));
    // Only the manuscript's own sub-headings are listed as the section's steps.
    const labels = s.paras.map((p) => p.label).filter(Boolean).slice(0, 4);
    const overview = clip(
      `${(s.key && ROLE[s.key]?.split(".")[0]) || `This part covers ${s.heading.toLowerCase()}`}. ${labels.length > 1 ? `It covers ${joinList(labels.map((l) => `“${l}”`))}${s.paras.filter((p) => p.label).length > 4 ? ", and more" : ""}.` : ""} ${firstN(sectionText(s), 1, 220)}`,
      480
    );
    return { id: slug(s.heading, used), ch: s.ch, title, slides: "", overview, paras, qa: extractiveQA(s, c) };
  });

  // Figures, tables and references, as in the manuscript's back matter.
  const refsRaw = src.references.length ? src.references : outline.references;
  const lastCh = Math.max(1, ...Object.keys(outline.chapters).map(Number));
  const backParas: GuidePara[] = [];
  const figs = outline.captions.filter((x) => /^fig/i.test(x));
  const tabs = outline.captions.filter((x) => /^table/i.test(x));
  if (figs.length) backParas.push({ label: "Figures", gist: `The manuscript has ${figs.length} figure${figs.length > 1 ? "s" : ""}: ${clip(figs.join("; "), 360)}`, role: "Know what each figure shows and where it is discussed.", orig: figs.join("\n") });
  if (tabs.length) backParas.push({ label: "Tables", gist: `The manuscript has ${tabs.length} table${tabs.length > 1 ? "s" : ""}: ${clip(tabs.join("; "), 360)}`, role: "Know what each table summarises and how to read its values.", orig: tabs.join("\n") });
  if (refsRaw.length) backParas.push({ label: "References", gist: `The reference list has ${refsRaw.length} entries. The Sources tab lists each one and where it is cited.`, role: "Every source cited in the text should appear in the list, and every listed source should be cited.", orig: `${refsRaw.length} references (see the Sources tab).` });
  const chapters = { ...outline.chapters };
  if (backParas.length) {
    chapters[lastCh + 1] = "Figures, Tables & References";
    sections.push({ id: slug("refs", used), ch: lastCh + 1, title: "Figures, Tables, and References", slides: "Not a slide", overview: "The back matter: the figures and tables the text refers to and the full reference list. Check that every in-text citation appears in the list.", paras: backParas, qa: [] });
  }

  // Slides: title slide, one per substantive section, closing slide.
  const slides: StudyGuideData["slides"] = [];
  const first = src.authors[0]?.name ? displayCase(src.authors[0].name) : "";
  slides.push({
    n: 1,
    title: "Title slide",
    note: clip(
      `This presentation introduces the study “${displayCase(src.title)}”${first ? ` by ${joinList(src.authors.map((a) => displayCase(a.name)).filter(Boolean))}` : ""}. ${c.objective ? `In brief, ${c.objective.replace(/^(this|the) (study|research|paper|inquiry)\s+/i, "the study ")}` : ""}`,
      700
    ),
  });
  let n = 1;
  let prevKey: SectionKey | null = null;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const os = outline.sections[i];
    if (!os) continue;
    if (os.key && os.key in NOT_A_SLIDE && NOT_A_SLIDE[os.key] !== "") {
      s.slides = NOT_A_SLIDE[os.key] as string;
      continue;
    }
    const small = sectionText(os).length < 500 && slides.length > 1 && prevKey !== null;
    if (!small) {
      n++;
      slides.push({ n, title: capFirst(shortHeading(s.title).toLowerCase()), note: clip(s.paras.slice(0, 2).map((p) => p.gist).join(" "), 600) });
    } else {
      const last = slides[slides.length - 1];
      last.note = clip(`${last.note} ${s.paras[0]?.gist ?? ""}`, 700);
    }
    s.slides = `Slide ${n}`;
    prevKey = os.key;
  }
  n++;
  slides.push({
    n,
    title: c.stage === "proposal" ? "Expected contribution and closing" : "Conclusion and closing",
    note: clip(`${c.stage === "proposal" ? c.significance : c.conclusion || c.significance} The presentation closes by inviting questions.`.trim(), 600),
  });

  const elevator = [
    c.background,
    c.objective,
    [c.methods.design && `Design: ${c.methods.design.replace(/[.;]\s*$/, "")}.`, c.methods.participants && `Participants: ${c.methods.participants.replace(/[.;]\s*$/, "")}.`, c.methods.analysis && `Analysis: ${c.methods.analysis.replace(/[.;]\s*$/, "")}.`].filter(Boolean).join(" "),
    c.stage === "results" ? c.findings.slice(0, 2).join(" ") : c.hypotheses.length ? `It tests: ${c.hypotheses.slice(0, 2).join(" ")}` : c.researchQuestions.slice(0, 2).join(" "),
    c.stage === "results" ? c.conclusion || c.implications[0] || "" : c.significance,
  ]
    .map((x) => clip(plain(x ?? ""), 300))
    .filter((x) => x.length > 20);

  const minutes = Math.max(5, Math.round((slides.length * 70) / 60));
  const chips = [
    c.methods.design && clip(c.methods.design.split(/[.;]/)[0], 64),
    c.methods.participants && clip(c.methods.participants.split(/[.;]/)[0], 64),
    c.methods.analysis && clip(c.methods.analysis.split(/[.;]/)[0], 64),
    c.methods.setting && clip(c.methods.setting.split(/[.;]/)[0], 64),
    src.discipline,
    ...src.keywords.split(/[;,]/).map((k) => k.trim()).filter(Boolean).slice(0, 3),
  ].filter((x): x is string => !!x && x.length > 2);

  return neutralGuide({
    version: STUDY_GUIDE_VERSION,
    mode: "extractive",
    model: "extractive",
    generatedAt: new Date().toISOString(),
    chapters,
    sections,
    numbers: extractNumbers(outline.sections).map(({ v, t }) => ({ v, t })),
    glossary: extractGlossary(outline.sections, src.keywords),
    elevator: elevator.length ? elevator : [clip(plain(src.abstract), 300)],
    refs: buildRefs(refsRaw, sections),
    slides,
    big: bigPicture(src, outline, sections),
    pace: `≈ ${minutes} minutes overall`,
    chips: [...new Set(chips)].slice(0, 7),
  });
}

// ─── LLM enrichment ────────────────────────────────────────────────────────

const SECTION_PROMPT = `You are an experienced research adviser preparing a study guide for a published study. For each manuscript section you are given, explain it so any reader can understand, present and discuss it without notes.

Return JSON: {"sections":[{"id":"<id as given>","overview":"...","slideNote":"...","paras":[{"i":0,"label":"...","gist":"...","role":"..."}],"qa":[{"q":"...","a":"..."}]}]}

- overview: 2–3 sentences on what the section does and how to remember its logic.
- paras: one entry per paragraph, by its index i. label: 2–6 word title. gist: "What it says" — a faithful plain-language paraphrase in 2–4 sentences. role: "Why it's there · how to present it" — 1–2 sentences, may include a suggested way to say it.
- qa: 2–3 questions a reader or reviewer is likely to ask about this section, each with a model answer of 2–4 sentences.
- slideNote: presentation notes for this section's slide, 3–5 sentences.

Rules: write everything from a general, third-person point of view about the study ("the study", "the researchers", "this section"); never use first person (I, me, my, we, us, our) and never speak as the author. Use ONLY the given text. Never invent numbers, names, sources, findings or results; copy any number exactly as written. If the text is a proposal (future tense, no results), never present findings. Plain, precise academic English.`;

const GUIDE_PROMPT = `You are an experienced research adviser preparing a study guide for a published study. From the manuscript facts given, return JSON:

{"elevator":["5 sentences: context and problem; aim; method; main findings (or, for a proposal, what is tested); significance"],
 "numbers":[{"i":0,"t":"what this number refers to in the study, ≤ 18 words"}],
 "glossary":[{"i":0,"def":"plain definition as used in this study, 1–2 sentences"}],
 "titleNote":"presentation notes for the title slide: the study's title and authors, then a one-sentence summary",
 "closingNote":"presentation notes for the closing slide: conclusion or expected contribution, then an invitation to questions"}

Rules: write from a general, third-person point of view about the study ("the study", "the researchers"); never use first person (I, me, my, we, us, our) and never speak as the author. Use ONLY the given facts; copy numbers exactly; never invent findings, names or sources.`;

const LLM_BUDGET_MS = 140_000;
const BATCH_CHARS = 9000;
const CONCURRENCY = 3;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function s(v: unknown, max: number): string {
  return typeof v === "string" ? clip(squash(v), max) : "";
}

/** Every number in `text` appears in the source (so nothing is invented). */
function grounded(text: string, sourceNorm: string): boolean {
  const nums = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return nums.every((n) => numberGroundedIn(n, sourceNorm));
}

function norm(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ");
}

async function enrichSections(guide: StudyGuideData, deadline: number): Promise<{ done: number; total: number; model: string }> {
  const work = guide.sections.filter((x) => x.id !== "refs" && !x.id.startsWith("refs"));
  const batches: GuideSection[][] = [];
  let cur: GuideSection[] = [];
  let size = 0;
  for (const sec of work) {
    const len = sec.paras.reduce((t, p) => t + Math.min(p.orig.length, 2200), 0);
    if (cur.length && size + len > BATCH_CHARS) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(sec);
    size += len;
  }
  if (cur.length) batches.push(cur);

  let done = 0;
  let model = "";
  const slideBySection = new Map<string, string>();
  const run = async (batch: GuideSection[]) => {
    const left = deadline - Date.now();
    if (left < 15_000) return;
    const prompt = batch
      .map((sec) => `### id: ${sec.id}\nSection: ${sec.title}\n${sec.paras.map((p, i) => `[${i}] ${clip(p.orig, 2200)}`).join("\n")}`)
      .join("\n\n");
    try {
      const res = await withTimeout(chatJSON<any>(SECTION_PROMPT, prompt, { maxTokens: 6000, temperature: 0.2, priority: "cost-first" }), left - 5000);
      model = res.model;
      const out: any[] = Array.isArray(res.data?.sections) ? res.data.sections : [];
      for (const sec of batch) {
        const o = out.find((x) => x?.id === sec.id);
        if (!o) continue;
        const srcNorm = norm(sec.paras.map((p) => p.orig).join(" "));
        const ov = s(o.overview, 600);
        if (ov && grounded(ov, srcNorm)) sec.overview = ov;
        for (const p of Array.isArray(o.paras) ? o.paras : []) {
          const i = Number(p?.i);
          const para = sec.paras[i];
          if (!para) continue;
          const pn = norm(para.orig);
          const gist = s(p.gist, 700);
          const role = s(p.role, 420);
          const label = s(p.label, 60).replace(/[.:]$/, "");
          if (gist && grounded(gist, pn)) para.gist = gist;
          if (role && grounded(role, pn)) para.role = role;
          // Keep the manuscript's own sub-headings; replace only derived labels.
          if (label && /^Paragraph \d+$|^[A-Z][a-z]/.test(para.label) && !sec.paras.some((x) => x !== para && x.label === label)) {
            if (!/[A-Z]{2}/.test(para.label) && para.label.split(" ").length >= 5) para.label = label;
            else if (/^Paragraph \d+$/.test(para.label)) para.label = label;
          }
        }
        const qa = (Array.isArray(o.qa) ? o.qa : [])
          .map((x: any) => ({ q: s(x?.q, 240), a: s(x?.a, 900) }))
          .filter((x: { q: string; a: string }) => x.q && x.a && grounded(x.a, srcNorm))
          .slice(0, 3);
        if (qa.length) sec.qa = qa;
        const note = s(o.slideNote, 900);
        if (note && grounded(note, srcNorm)) slideBySection.set(sec.id, note);
      }
      done += batch.length;
    } catch (e) {
      console.error(`[study-guide] section batch failed (${batch.map((b) => b.id).join(", ")}):`, (e as Error).message);
    }
  };
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.all(batches.slice(i, i + CONCURRENCY).map(run));
  }
  // Slide notes follow their sections.
  for (const sl of guide.slides) {
    const secs = guide.sections.filter((x) => x.slides === `Slide ${sl.n}`);
    const notes = secs.map((x) => slideBySection.get(x.id)).filter(Boolean) as string[];
    if (notes.length) sl.note = clip(notes.join(" "), 1100);
  }
  return { done, total: work.length, model };
}

async function enrichGuide(guide: StudyGuideData, src: StudyGuideSource, sourceNorm: string, deadline: number): Promise<boolean> {
  const left = deadline - Date.now();
  if (left < 15_000) return false;
  const c = src.content;
  const facts = [
    `Title: ${src.title}`,
    `Stage: ${c.stage === "proposal" ? "proposal (no results yet)" : "completed study with results"}`,
    `Background: ${c.background}`,
    `Objective: ${c.objective}`,
    c.researchQuestions.length ? `Research questions: ${c.researchQuestions.join(" | ")}` : "",
    c.hypotheses.length ? `Hypotheses: ${c.hypotheses.join(" | ")}` : "",
    `Design: ${c.methods.design}; Participants: ${c.methods.participants}; Setting: ${c.methods.setting}; Instruments: ${c.methods.instruments}; Analysis: ${c.methods.analysis}`,
    c.findings.length ? `Findings: ${c.findings.join(" | ")}` : "",
    c.conclusion ? `Conclusion: ${c.conclusion}` : "",
    c.significance ? `Significance: ${c.significance}` : "",
    `Abstract: ${src.abstract}`,
    `Authors: ${src.authors.map((a) => a.name).join(", ")}`,
    "",
    "NUMBERS (index: value — context):",
    ...guide.numbers.map((n, i) => `${i}: ${n.v} — ${n.t}`),
    "",
    "TERMS (index: term — context):",
    ...guide.glossary.map((g, i) => `${i}: ${g.term} — ${clip(g.def_, 200)}`),
  ]
    .filter((x) => x !== "")
    .join("\n");
  try {
    const { data } = await withTimeout(chatJSON<any>(GUIDE_PROMPT, facts, { maxTokens: 5000, temperature: 0.2, priority: "cost-first" }), left - 5000);
    const el = (Array.isArray(data?.elevator) ? data.elevator : []).map((x: unknown) => s(x, 360)).filter((x: string) => x.length > 20 && grounded(x, sourceNorm));
    if (el.length >= 3) guide.elevator = el.slice(0, 6);
    for (const x of Array.isArray(data?.numbers) ? data.numbers : []) {
      const n = guide.numbers[Number(x?.i)];
      const t = s(x?.t, 200);
      if (n && t && grounded(t, sourceNorm)) n.t = t;
    }
    for (const x of Array.isArray(data?.glossary) ? data.glossary : []) {
      const g = guide.glossary[Number(x?.i)];
      const d = s(x?.def, 400);
      if (g && d && grounded(d, sourceNorm)) g.def_ = d;
    }
    const title = s(data?.titleNote, 900);
    if (title && grounded(title, sourceNorm) && guide.slides[0]) guide.slides[0].note = title;
    const closing = s(data?.closingNote, 900);
    if (closing && grounded(closing, sourceNorm) && guide.slides.length > 1) guide.slides[guide.slides.length - 1].note = closing;
    return true;
  } catch (e) {
    console.error("[study-guide] guide-level enrichment failed:", (e as Error).message);
    return false;
  }
}

export async function generateStudyGuide(src: StudyGuideSource): Promise<StudyGuideData> {
  const guide = buildExtractiveGuide(src);
  if (!anyLLMAvailable()) return guide;
  const deadline = Date.now() + LLM_BUDGET_MS;
  const sourceNorm = norm(`${src.title} ${src.abstract} ${guide.sections.flatMap((x) => x.paras.map((p) => p.orig)).join(" ")}`);
  const [sec, ok] = await Promise.all([enrichSections(guide, deadline), enrichGuide(guide, src, sourceNorm, deadline)]);
  // Only a guide whose sections were (almost) all explained by the model counts as complete.
  if (ok && sec.total > 0 && sec.done >= Math.ceil(sec.total * 0.8)) {
    guide.mode = "llm";
    guide.model = sec.model || "llm";
  }
  return neutralGuide(guide);
}

// ─── Cache ─────────────────────────────────────────────────────────────────

function sourceHash(src: StudyGuideSource): string {
  return createHash("sha256")
    .update(
      [
        STUDY_GUIDE_VERSION,
        src.title,
        src.abstract,
        src.keywords,
        JSON.stringify(src.authors.map((a) => a.name)),
        src.bodyHtml ?? "",
        src.references.join("\n"),
        src.content.mode,
        src.content.generatedAt.slice(0, 10),
      ].join("\n")
    )
    .digest("hex")
    .slice(0, 24);
}

const memo = new Map<string, Promise<StudyGuideData>>();
const PARTIAL_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * The cached guide for an article. The storage key changes with the
 * article's text, so an edited or re-published article gets a new guide.
 * A guide built without (or with only part of) the LLM is kept for a few
 * hours only, so it upgrades once the model is reachable again.
 */
export async function getStudyGuide(src: StudyGuideSource): Promise<StudyGuideData> {
  const key = `study-guides/${src.id}/${sourceHash(src)}.json`;
  const pending = memo.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const cached = await getObject(key);
      if (cached) {
        const parsed = JSON.parse(cached.toString("utf-8")) as StudyGuideData;
        const fresh = parsed?.mode === "llm" || !anyLLMAvailable() || Date.now() - Date.parse(parsed?.generatedAt ?? "") < PARTIAL_TTL_MS;
        if (parsed?.version === STUDY_GUIDE_VERSION && fresh) return parsed;
      }
    } catch {
      // cache miss / storage unavailable — generate below
    }
    const guide = await generateStudyGuide(src);
    await putObject(key, Buffer.from(JSON.stringify(guide), "utf-8"), "application/json").catch((e) => console.error("[study-guide] cache write failed", e));
    return guide;
  })();
  memo.set(key, p);
  p.then((g) => g.mode !== "llm" && memo.delete(key), () => memo.delete(key));
  if (memo.size > 100) memo.delete(memo.keys().next().value as string);
  return p;
}
