/**
 * Section-aware passages for the Research Assistant, built from an
 * article's HTML galley instead of its flattened text, so every passage
 * knows where it sits in the paper ("Methods › Sampling"), tables stay
 * tables, figure captions are their own passages, and the reference list
 * can be told apart from the body. Citations can then say "Results ›
 * Table 2" and a question about methods can favour the Methods section.
 *
 * Pure (no database), so it can be tested on sample HTML.
 */
import { Parser } from "htmlparser2";

export type PassageKind = "text" | "table" | "figure" | "references";

export interface SectionPassage {
  text: string;
  /** Headings above the passage, outermost first (numbering removed). */
  headingPath: string[];
  /** The canonical part of the paper (see canonicalSection), or null. */
  section: string | null;
  kind: PassageKind;
}

/** Canonical parts of a research paper, matched from heading text. */
const SECTION_PATTERNS: [string, RegExp][] = [
  ["references", /^(references?|bibliography|works cited|literature cited|reference list|sources)$/],
  ["abstract", /^abstract$/],
  ["limitations", /limitation/],
  ["methods", /method|materials|research design|study design|design and|participants|respondents|sampl|population|instrument|procedure|data (collection|gathering|analysis)|statistical (analysis|treatment)|study (area|site|setting)|setting|measures|ethic/],
  ["results", /results?|findings|presentation|analysis and interpretation/],
  ["discussion", /discussion|interpretation/],
  ["conclusion", /conclu|recommendation|implication|summary|future (work|research)/],
  ["introduction", /introduction|background|literature|related work|theor|conceptual|framework|statement of the problem|problem statement|research (questions?|objectives?|gap)|objectives?|hypothes|significance|scope|rationale|purpose/],
  ["other", /acknowledg|funding|conflicts? of interest|competing interests|declaration|appendi|author contributions|data availability/],
];

/** "2.1. Sampling Procedure" → "sampling procedure" → "methods". */
export function canonicalSection(heading: string): string | null {
  const h = heading
    .toLowerCase()
    .replace(/^\s*(chapter\s+)?([ivxlc]+|\d+(\.\d+)*)[.):]?\s+/i, "")
    .replace(/[:.]+$/, "")
    .trim();
  if (!h) return null;
  for (const [section, re] of SECTION_PATTERNS) if (re.test(h)) return section;
  return null;
}

/** The canonical section of a heading path: the deepest heading that names one. */
export function sectionOfPath(path: string[]): string | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const s = canonicalSection(path[i]);
    if (s) return s;
  }
  return null;
}

/** The question sections of src/lib/suggested-questions.ts → canonical sections to favour. */
const QUESTION_SECTIONS: [RegExp, string[]][] = [
  [/limitation|weakness|shortcoming/, ["limitations", "discussion", "conclusion"]],
  [/recommend|implication|suggest|future (research|work)/, ["conclusion", "discussion"]],
  [/conclu/, ["conclusion", "discussion"]],
  [/discussion|interpret|explain the results/, ["discussion"]],
  [/results?\b|findings?|\bfound\b|\b(did|do|does) (they|the (study|studies|authors?|researchers?|paper)) find\b|outcomes?/, ["results", "discussion"]],
  [/analy[sz]|statistic|thematic|coding/, ["methods", "results"]],
  [/\bdesign\b|\bmethods?\b|methodology|\bapproach\b|respondent|participant|sample|population|subjects|instrument|questionnaire|survey|interview guide|\bscale\b|procedure/, ["methods"]],
  [/background|context|introduction|literature|\bgaps?\b|research questions?|objectives?|problem statement|statement of the problem|hypothes|framework|theor|significance/, ["introduction"]],
  [/\breferences?\b|\bcite[sd]?\b|bibliograph|sources they (cite|used)/, ["references"]],
];

/** Canonical sections a question is about (empty when it isn't about a part of the paper). */
export function sectionsForQuestion(question: string): string[] {
  const q = question.toLowerCase();
  const out: string[] = [];
  for (const [re, sections] of QUESTION_SECTIONS) {
    if (re.test(q)) for (const s of sections) if (!out.includes(s)) out.push(s);
  }
  return out;
}

const PASSAGE_TARGET = 800;
const PASSAGE_OVERLAP = 120;
const TABLE_MAX = 1600;

/** Splits a section's text into ~800-character passages at sentence boundaries. */
function splitText(text: string): string[] {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  if (!clean) return [];
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + PASSAGE_TARGET, clean.length);
    if (end < clean.length) {
      const windowStart = Math.max(start, end - 150);
      const window = clean.slice(windowStart, end);
      const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (cut !== -1) end = windowStart + cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - PASSAGE_OVERLAP, start + 1);
  }
  return out;
}

const cell = (s: string) => s.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();

/** A table as Markdown, split into row groups (each repeating the header) when it is long. */
function tableToMarkdown(caption: string, rows: { cells: string[]; header: boolean }[]): string[] {
  const usable = rows.filter((r) => r.cells.some((c) => c.trim()));
  if (usable.length === 0) return caption ? [`Table: ${caption}`] : [];
  const width = Math.max(...usable.map((r) => r.cells.length));
  const pad = (cells: string[]) => [...cells, ...Array(width - cells.length).fill("")];
  const headerRow = usable[0].header ? usable[0] : null;
  const body = headerRow ? usable.slice(1) : usable;
  const head = headerRow ? pad(headerRow.cells) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const headLines = `| ${head.map(cell).join(" | ")} |\n|${" --- |".repeat(width)}`;
  const title = caption ? `Table: ${caption}\n` : "";
  const out: string[] = [];
  let current: string[] = [];
  const flush = () => {
    out.push(`${title}${headLines}\n${current.join("\n")}`.trim());
    current = [];
  };
  for (const r of body) {
    const line = `| ${pad(r.cells).map(cell).join(" | ")} |`;
    if (current.length && title.length + headLines.length + current.join("\n").length + line.length > TABLE_MAX) flush();
    current.push(line);
  }
  if (current.length || out.length === 0) flush();
  return out;
}

const BLOCKS = new Set(["p", "li", "blockquote", "pre", "dd", "dt", "h1", "h2", "h3", "h4", "h5", "h6", "div", "section", "article", "br", "tr", "figcaption"]);
const SKIP = new Set(["script", "style", "head", "header", "footer", "nav", "noscript", "svg", "math"]);

/**
 * The passages of an HTML galley. Reads the article body
 * (<div class="article-body">, as src/lib/galley.ts writes it) when there
 * is one, otherwise the whole page minus the title and front matter.
 */
export function galleyToPassages(html: string): SectionPassage[] {
  const hasBody = /class=["'][^"']*\barticle-body\b/.test(html);
  const passages: SectionPassage[] = [];
  const path: { level: number; text: string }[] = [];
  let sectionText = "";

  // Parser state.
  const stack: { name: string; skip: boolean; body: boolean }[] = [];
  let inBody = !hasBody;
  let skipDepth = 0;
  let heading: { level: number; text: string } | null = null;
  let table: { caption: string; rows: { cells: string[]; header: boolean }[]; row: { cells: string[]; header: boolean } | null; cell: string | null; captionOpen: boolean } | null = null;
  let figure: { caption: string; alt: string[]; captionOpen: boolean } | null = null;

  const currentPath = () => path.map((p) => p.text);
  const flushSection = () => {
    const p = currentPath();
    const section = sectionOfPath(p);
    for (const text of splitText(sectionText)) passages.push({ text, headingPath: p, section, kind: section === "references" ? "references" : "text" });
    sectionText = "";
  };
  const addText = (t: string) => {
    if (heading) heading.text += t;
    else if (table) {
      if (table.captionOpen) table.caption += t;
      else if (table.cell !== null) table.cell += t;
    } else if (figure) {
      if (figure.captionOpen) figure.caption += t;
    } else sectionText += t;
  };

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const cls = attrs.class ?? "";
        const skip = SKIP.has(name) || (!hasBody && /\b(front|abstract|journal|authors|affiliations|doi|licence)\b/.test(cls)) || (!hasBody && name === "h1");
        const body = hasBody && /\barticle-body\b/.test(cls);
        stack.push({ name, skip, body });
        if (skip) skipDepth++;
        if (body) inBody = true;
        if (!inBody || skipDepth > 0) return;
        if (/^h[1-6]$/.test(name)) {
          flushSection();
          heading = { level: Number(name[1]), text: "" };
        } else if (name === "table") {
          // Text before the table becomes its own passage(s) first, so passages stay in reading order.
          flushSection();
          table = { caption: "", rows: [], row: null, cell: null, captionOpen: false };
        } else if (table && name === "caption") table.captionOpen = true;
        else if (table && name === "tr") table.row = { cells: [], header: false };
        else if (table && (name === "td" || name === "th")) {
          table.cell = "";
          if (name === "th" && table.row) table.row.header = true;
        } else if (name === "figure") {
          flushSection();
          figure = { caption: "", alt: [], captionOpen: false };
        }
        else if (figure && name === "figcaption") figure.captionOpen = true;
        else if (figure && name === "img" && attrs.alt) figure.alt.push(attrs.alt);
        else if (BLOCKS.has(name)) addText("\n");
      },
      ontext(text) {
        if (!inBody || skipDepth > 0) return;
        addText(text);
      },
      onclosetag(name) {
        const open = stack.pop();
        if (open?.skip) skipDepth--;
        const wasBodyEnd = open?.body;
        if (inBody && skipDepth === 0 && !(open?.skip)) {
          if (heading && /^h[1-6]$/.test(name)) {
            const text = heading.text.replace(/\s+/g, " ").replace(/^\s*(\d+(\.\d+)*\.?|[ivxlc]+\.)\s+/i, "").trim();
            const level = heading.level;
            heading = null;
            if (text) {
              while (path.length && path[path.length - 1].level >= level) path.pop();
              path.push({ level, text });
            }
          } else if (table) {
            if (name === "caption") table.captionOpen = false;
            else if ((name === "td" || name === "th") && table.row && table.cell !== null) {
              table.row.cells.push(table.cell);
              table.cell = null;
            } else if (name === "tr" && table.row) {
              table.rows.push(table.row);
              table.row = null;
            } else if (name === "table") {
              const p = currentPath();
              for (const text of tableToMarkdown(table.caption.replace(/\s+/g, " ").trim(), table.rows)) {
                passages.push({ text, headingPath: p, section: sectionOfPath(p), kind: "table" });
              }
              table = null;
            }
          } else if (figure) {
            if (name === "figcaption") figure.captionOpen = false;
            else if (name === "figure") {
              const caption = figure.caption.replace(/\s+/g, " ").trim();
              const alt = figure.alt.join(" ").replace(/\s+/g, " ").trim();
              const text = caption || alt;
              if (text) {
                const p = currentPath();
                passages.push({ text: `Figure: ${text}${caption && alt && alt !== caption ? ` (${alt})` : ""}`, headingPath: p, section: sectionOfPath(p), kind: "figure" });
              }
              figure = null;
            }
          } else if (BLOCKS.has(name)) addText("\n");
        }
        if (wasBodyEnd) {
          flushSection();
          inBody = false;
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true }
  );
  parser.write(html);
  parser.end();
  flushSection();
  return passages;
}
