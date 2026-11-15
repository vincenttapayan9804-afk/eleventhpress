/**
 * Reads a published article's body into the outline a study guide is
 * built on: chapters → sections → paragraphs, plus the reference list and
 * the figure/table captions.
 *
 * Works on the galley's article-body HTML, where headings are <h1>–<h6> or
 * paragraphs that are entirely bold (typical of Word theses), and falls
 * back to the abstract's own labelled parts when there is no full text.
 */
import { decodeEntities, displayCase, headingKey, squash, type SectionKey } from "@/lib/research-visuals";

export interface OutlinePara {
  /** Sub-heading or bold lead-in that introduces this paragraph, if any. */
  label: string;
  text: string;
}

export interface OutlineSection {
  /** Chapter number this section belongs to (1-based). */
  ch: number;
  /** The heading as written (display-cased). */
  heading: string;
  /** What kind of section it is, when recognisable. */
  key: SectionKey | null;
  paras: OutlinePara[];
}

export interface Outline {
  /** Chapter labels by number, e.g. {1: "Chapter 1 · Introduction"}. */
  chapters: Record<number, string>;
  sections: OutlineSection[];
  /** Reference entries found in the body's own reference list. */
  references: string[];
  /** "Figure 1. …" / "Table 2. …" captions, in order. */
  captions: string[];
  /** True when the outline came from the full text (not just the abstract). */
  fullText: boolean;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

function chapterNumber(text: string): number | null {
  const m = squash(text).match(/^chapter\s+([ivx]+|\d+)\b\.?\s*[:.\-–—]?\s*(.*)$/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const n = ROMAN[raw] ?? Number(raw);
  return Number.isFinite(n) && n > 0 && n < 20 ? n : null;
}

function chapterRest(text: string): string {
  return squash(text).replace(/^chapter\s+([ivx]+|\d+)\b\.?\s*[:.\-–—]?\s*/i, "").trim();
}

const CAPTION_RE = /^(figure|fig\.|table|plate|chart|graph)\s*\d+[a-z]?\s*[:.\-–—]?/i;

/** IMRaD grouping for articles without "Chapter N" headings. */
function imradChapter(key: SectionKey | null): number | null {
  if (!key) return null;
  if (["background", "purpose", "problem", "hypotheses", "framework", "significance", "scope", "literature", "definitions"].includes(key)) return 1;
  if (["design", "participants", "setting", "instruments", "procedure", "analysis", "ethics"].includes(key)) return 2;
  if (["results", "discussion"].includes(key)) return 3;
  if (["conclusion", "recommendations", "limitations"].includes(key)) return 4;
  return null;
}

const IMRAD_LABELS: Record<number, string> = {
  1: "Part 1 · Introduction",
  2: "Part 2 · Methods",
  3: "Part 3 · Results and Discussion",
  4: "Part 4 · Conclusions",
};

const IS_REFERENCES = /^(references?|bibliography|literature cited|works cited|reference list)\b/i;
const IS_BACK_MATTER = /^(appendix|appendices|curriculum vitae|acknowledge?ments?|about the authors?|author (biograph|contribution)|conflicts? of interest|funding|data availability)\b/i;
const IS_FRONT_MATTER = /^(table of contents|contents|list of (tables|figures|appendices)|title page|approval sheet|dedication|abstract|authors?|author information|affiliations?|keywords|how to cite|citation)\b/i;

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

/** A heading strong enough to start its own study-guide section. */
function isMajorHeading(tag: string, text: string, key: SectionKey | null): boolean {
  if (key) return true;
  if (/^h[12]$/i.test(tag)) return true;
  if (/^(\d+(\.\d+)?|[IVX]+)[.)]?\s+\S/.test(text)) return true;
  return isAllCaps(text);
}

function cleanHeading(text: string): string {
  return displayCase(squash(text).replace(/[\s:.;,]+$/, ""));
}

interface Block {
  tag: string;
  text: string;
  heading: boolean;
  lead: string;
}

function blocksOf(bodyHtml: string): Block[] {
  const html = bodyHtml
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    // Tables are shown as tables in the article; only their captions matter here.
    .replace(/<table\b[\s\S]*?<\/table>/gi, " ");
  const out: Block[] = [];
  const re = /<(h[1-6]|p|li|figcaption|caption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const inner = m[2];
    const text = squash(decodeEntities(inner.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")));
    if (!text) continue;
    const bold = squash(decodeEntities([...inner.matchAll(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((x) => x[2].replace(/<[^>]+>/g, " ")).join(" ")));
    const tag = m[1].toLowerCase();
    const heading =
      text.length <= 150 &&
      (/^h/.test(tag) || (tag === "p" && text.length <= 120 && bold.length > 0 && bold === text && !/[.?!]["”]?$/.test(text.replace(/\b(etc|al|vs)\.$/i, ""))));
    const leadM = inner.match(/^\s*(?:<[^>]+>\s*)*?<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i);
    const lead = leadM ? squash(decodeEntities(leadM[2].replace(/<[^>]+>/g, " "))) : "";
    out.push({ tag, text, heading, lead: !heading && lead.length >= 3 && lead.length <= 90 && text.startsWith(lead.slice(0, 15)) ? lead.replace(/[.:–—-]\s*$/, "") : "" });
  }
  return out;
}

/** Paragraphs this short are list items or stray lines; they are merged into a neighbour. */
const SHORT_PARA = 140;

function addPara(section: OutlineSection, label: string, text: string, listItem: boolean) {
  const last = section.paras[section.paras.length - 1];
  // Consecutive list items, and short lines, join the paragraph they belong to.
  if (last && !label && (listItem || text.length < SHORT_PARA || last.text.length < SHORT_PARA) && last.text.length + text.length < 1600) {
    last.text += (listItem ? "\n" : " ") + text;
    return;
  }
  section.paras.push({ label, text });
}

export function buildOutline(bodyHtml: string | null | undefined, abstract: string): Outline {
  const blocks = bodyHtml ? blocksOf(bodyHtml) : [];
  const sections: OutlineSection[] = [];
  const references: string[] = [];
  const captions: string[] = [];
  const chapterTitles: Record<number, string> = {};
  let usesChapters = blocks.some((b) => b.heading && chapterNumber(b.text) !== null);
  let ch = 1;
  let cur: OutlineSection | null = null;
  let pendingLabel = "";
  let mode: "body" | "refs" | "skip" = "body";
  let awaitingChapterTitle = false;
  let bodyChars = 0;
  // Theses: the title page and table of contents come before "Chapter 1".
  let started = !usesChapters;

  for (const b of blocks) {
    if (!started) {
      if (!(b.heading && chapterNumber(b.text) !== null)) continue;
      started = true;
    }
    if (CAPTION_RE.test(b.text) && b.text.length < 300) {
      if (!captions.includes(b.text)) captions.push(b.text);
      continue;
    }
    if (b.heading) {
      const n = chapterNumber(b.text);
      if (n !== null) {
        // "CHAPTER I" (title on the next heading) or "Chapter 1: Introduction".
        if (bodyChars > 2000 || mode === "body") {
          ch = n;
          mode = "body";
          const rest = chapterRest(b.text);
          if (rest) chapterTitles[ch] = cleanHeading(rest);
          awaitingChapterTitle = !rest;
          cur = null;
        }
        continue;
      }
      if (IS_REFERENCES.test(b.text)) {
        // A table of contents lists "References" too; only switch once real content was read.
        if (bodyChars > 300) mode = "refs";
        cur = null;
        continue;
      }
      if (IS_BACK_MATTER.test(b.text)) {
        if (bodyChars > 300) mode = "skip";
        cur = null;
        continue;
      }
      if (mode !== "body") continue;
      if (IS_FRONT_MATTER.test(b.text)) {
        cur = null;
        continue;
      }
      const key = headingKey(b.text);
      if (awaitingChapterTitle && !chapterTitles[ch]) {
        chapterTitles[ch] = cleanHeading(b.text);
        awaitingChapterTitle = false;
        // A chapter title that is also a section name ("INTRODUCTION") opens that section.
        if (!key) continue;
      }
      if (!usesChapters) {
        const c = imradChapter(key);
        if (c && c >= ch) ch = c;
      }
      if (isMajorHeading(b.tag, b.text, key) || !cur) {
        cur = { ch, heading: cleanHeading(b.text), key, paras: [] };
        sections.push(cur);
        pendingLabel = "";
      } else {
        pendingLabel = cleanHeading(b.text);
      }
      continue;
    }
    if (mode === "refs") {
      if (b.text.length > 25) references.push(b.text);
      continue;
    }
    if (mode === "skip" || !cur) continue;
    if (b.text.length < 25 && !pendingLabel) continue;
    const label = pendingLabel || b.lead;
    pendingLabel = "";
    addPara(cur, label ? cleanHeading(label) : "", b.text, b.tag === "li");
    bodyChars += b.text.length;
  }

  let kept = sections.filter((s) => s.paras.some((p) => p.text.length >= 60));
  // Keep the guide readable: very long sections fold paragraph pairs together.
  for (const s of kept) {
    while (s.paras.length > 14) {
      const merged: OutlinePara[] = [];
      for (let i = 0; i < s.paras.length; i += 2) {
        const a = s.paras[i];
        const b2 = s.paras[i + 1];
        merged.push(b2 ? { label: a.label || b2.label, text: `${a.text}\n\n${b2.text}` } : a);
      }
      s.paras = merged;
    }
  }

  let fullText = kept.length >= 2 && bodyChars > 600;
  if (!fullText) {
    usesChapters = false;
    kept = abstractOutline(abstract);
  }

  // Chapter labels.
  const chapters: Record<number, string> = {};
  const used = [...new Set(kept.map((s) => s.ch))].sort((a, b) => a - b);
  for (const n of used) {
    if (usesChapters) {
      const t = chapterTitles[n] ?? kept.find((s) => s.ch === n)?.heading ?? "";
      chapters[n] = `Chapter ${n}${t ? ` · ${t}` : ""}`;
    } else if (fullText) {
      chapters[n] = IMRAD_LABELS[n] ?? `Part ${n}`;
    } else {
      chapters[n] = "Abstract";
    }
  }
  return { chapters, sections: kept, references, captions, fullText };
}

const ABSTRACT_LABEL = /(?:^|\s)(Background|Introduction|Context|Purpose|Aims?|Objectives?|Design\/methodology\/approach|Methods?|Methodology|Materials and methods|Results?|Findings|Conclusions?|Implications|Practical implications|Originality\/value|Limitations|Recommendations?)\s*[:.–—-]\s+/g;

/** The abstract as one short "section" (or its own labelled parts). */
function abstractOutline(abstract: string): OutlineSection[] {
  const text = squash(abstract);
  if (!text) return [];
  const parts: OutlinePara[] = [];
  const marks = [...text.matchAll(ABSTRACT_LABEL)];
  if (marks.length >= 2) {
    marks.forEach((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < marks.length ? marks[i + 1].index ?? text.length : text.length;
      const body = text.slice(start, end).trim();
      if (body) parts.push({ label: displayCase(m[1]), text: body });
    });
  } else {
    // Unlabelled abstract: two or three sentences per paragraph card.
    const sents = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (let i = 0; i < sents.length; i += 3) parts.push({ label: "", text: sents.slice(i, i + 3).join(" ") });
  }
  return [{ ch: 1, heading: "Abstract", key: null, paras: parts }];
}
