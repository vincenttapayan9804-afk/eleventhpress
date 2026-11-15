/**
 * Renders a study guide (src/lib/study-guide/build.ts) into the
 * Research Study Guide HTML: a single self-contained page with Study
 * Notes, Big Picture, Presentation Script, Defense Q&A, Flashcards, Key
 * Numbers, Glossary and Sources tabs, light/dark themes, search, review
 * progress and print.
 *
 * The page is the approved design (template.html, bundled as
 * template.generated.ts) with the article's content in place of the
 * placeholders. Branded with the publishing tenant's identity: its logo
 * and name, and on whitelabel tenants the fixed platform credit.
 */
import type { GuideModelColumn, StudyGuideData } from "@/lib/study-guide/build";
import { STUDY_GUIDE_TEMPLATE } from "@/lib/study-guide/template.generated";

export interface StudyGuideMeta {
  articleId: string;
  title: string;
  shortTitle: string;
  /** Display-cased author names. */
  authors: string[];
  affiliations: string[];
  journalName: string;
  publisher: string;
  publishedAt: Date | null;
  doi: string | null;
  articleUrl: string;
  /** "RESEARCH", "REVIEW", … */
  contentType: string;
  /** Logo as a data: URI (uploaded logo), or null. */
  logoDataUri: string | null;
  /** True for whitelabel tenants (no platform medallion; credit line shown). */
  whitelabel: boolean;
  poweredBy: string | null;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** JSON safe to embed inside a <script> element. */
function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

/** The study's model in the same visual language as the approved IPO figure. */
export function modelSvg(cols: GuideModelColumn[], feedback: string, title: string): string {
  const X = [6, 222, 438];
  const LINE = 15;
  const columnBoxes = cols.slice(0, 3).map((col, ci) => {
    let y = 48;
    return col.items.slice(0, 5).map((item) => {
      const lines = wrap(item, ci === 1 ? 22 : 25, 5);
      const h = 18 + lines.length * LINE;
      const box = { y, h, lines };
      y += h + 10;
      return box;
    });
  });
  const bottom = Math.max(200, ...columnBoxes.map((bs) => (bs.length ? bs[bs.length - 1].y + bs[bs.length - 1].h : 0))) + 10;
  const colH = bottom - 10;
  const mid = 10 + colH / 2;
  const height = bottom + (feedback ? 60 : 12);
  const parts: string[] = [];
  parts.push(`<svg class="model" viewBox="0 0 640 ${height}" role="img" aria-label="${esc(`${title}: ${cols.map((c) => `${c.label.toLowerCase()} — ${c.items.join(", ")}`).join("; ")}`)}">`);
  parts.push(`<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--navy)"/></marker></defs>`);
  cols.slice(0, 3).forEach((col, ci) => {
    const x = X[ci];
    const stroke = ci === 1 ? "var(--navy)" : "var(--brand)";
    parts.push(`<rect x="${x}" y="10" width="196" height="${colH}" rx="14" fill="var(--surface-2)" stroke="${stroke}" stroke-width="2"/>`);
    parts.push(`<text x="${x + 98}" y="34" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}" letter-spacing="1.5">${esc(col.label)}</text>`);
    for (const b of columnBoxes[ci]) {
      parts.push(`<rect x="${x + 10}" y="${b.y}" width="176" height="${b.h}" rx="12" fill="var(--surface)" stroke="${ci === 1 ? "var(--navy)" : "var(--line)"}" stroke-width="2"/>`);
      b.lines.forEach((ln, k) => {
        const ty = b.y + 20 + k * LINE;
        parts.push(
          ci === 1
            ? `<text x="${x + 98}" y="${ty}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--navy)">${esc(ln)}</text>`
            : `<text x="${x + 20}" y="${ty}" font-size="12" fill="var(--ink)">${esc(ln)}</text>`
        );
      });
    }
    const bs = columnBoxes[ci];
    if (ci === 1) {
      for (let k = 0; k + 1 < bs.length; k++) {
        parts.push(`<line x1="${x + 98}" y1="${bs[k].y + bs[k].h}" x2="${x + 98}" y2="${bs[k + 1].y - 2}" stroke="var(--navy)" stroke-width="2" marker-end="url(#ah)"/>`);
      }
    }
  });
  parts.push(`<line x1="204" y1="${mid}" x2="219" y2="${mid}" stroke="var(--navy)" stroke-width="2.5" marker-end="url(#ah)"/>`);
  parts.push(`<line x1="420" y1="${mid}" x2="435" y2="${mid}" stroke="var(--navy)" stroke-width="2.5" marker-end="url(#ah)"/>`);
  if (feedback) {
    parts.push(`<path d="M536,${bottom + 2} L536,${bottom + 36} L104,${bottom + 36} L104,${bottom + 4}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ah)"/>`);
    parts.push(`<text x="320" y="${bottom + 52}" text-anchor="middle" font-size="11.5" fill="var(--ink-2)">${esc(feedback)}</text>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}

/** The platform's "EP" medallion (the site header's .wax-mark), as inline SVG. */
const PLATFORM_SEAL = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style="flex-shrink:0"><defs><radialGradient id="epd" cx="32%" cy="26%" r="78%"><stop offset="0" stop-color="#b5a3f0"/><stop offset=".46" stop-color="#6f44bc"/><stop offset=".8" stop-color="#461e86"/><stop offset="1" stop-color="#221049"/></radialGradient><linearGradient id="epg" x1="0" y1="0" x2=".4" y2="1"><stop offset=".15" stop-color="#fae6bb"/><stop offset=".55" stop-color="#c78b28"/><stop offset="1" stop-color="#a2650a"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="#a2650a"/><circle cx="20" cy="20" r="19.3" fill="#efc880"/><circle cx="20" cy="20" r="18.6" fill="url(#epd)"/><text x="20" y="25.5" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="15" fill="url(#epg)">EP</text></svg>`;

const TYPE_LABEL: Record<string, string> = {
  RESEARCH: "Research Article",
  REVIEW: "Review Article",
  CASE_STUDY: "Case Study",
  SHORT_COMMUNICATION: "Short Communication",
  THESIS: "Thesis",
  DISSERTATION: "Dissertation",
  EXPERT_INSIGHT: "Expert Insight",
};

function monthYear(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
}

export function studyGuideFileName(meta: Pick<StudyGuideMeta, "authors" | "shortTitle">): string {
  const surname = (meta.authors[0] ?? "").replace(/,.*$/, "").trim().split(/\s+/).pop() ?? "";
  const base = (surname || meta.shortTitle.split(/\s+/).slice(0, 4).join(" ")).normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "Article"}_Research_Study_Guide.html`;
}

export function renderStudyGuideHtml(guide: StudyGuideData, meta: StudyGuideMeta): string {
  const typeLabel = TYPE_LABEL[meta.contentType] ?? "Research Article";
  const kicker = `Research Study Guide · ${typeLabel}`;
  const affs = [...new Set(meta.affiliations.filter(Boolean))];
  const who = [
    meta.authors.length ? `<b>${esc(meta.authors.join(", "))}</b>` : "",
    affs.length ? esc(affs.slice(0, 2).join("; ")) : "",
    esc(meta.journalName),
    esc(monthYear(meta.publishedAt)),
  ]
    .filter(Boolean)
    .join(" · ");
  const chips = guide.chips.map((c) => `          <span class="chip">${esc(c)}</span>`).join("\n");
  const logo = meta.logoDataUri
    ? `<img src="${esc(meta.logoDataUri)}" alt="${esc(meta.publisher)}" style="height:40px;width:auto;max-width:120px;object-fit:contain;flex-shrink:0;border-radius:8px">`
    : meta.whitelabel
      ? ""
      : PLATFORM_SEAL;
  const doiLink = meta.doi ? ` DOI: <a href="https://doi.org/${esc(meta.doi)}">${esc(meta.doi)}</a>.` : "";
  const footnote =
    `Built from the published version of “<a href="${esc(meta.articleUrl)}">${esc(meta.title)}</a>” (${esc(meta.journalName)}${meta.publishedAt ? `, ${esc(monthYear(meta.publishedAt))}` : ""}).${doiLink} ` +
    `Explanations, worked examples, and suggested answers are study aids; the published article remains the authoritative text. ` +
    `© ${esc(meta.publisher)}.${meta.poweredBy ? ` ${esc(meta.poweredBy)}.` : ""}`;

  const data = {
    chapters: guide.chapters,
    sections: guide.sections,
    numbers: guide.numbers,
    glossary: guide.glossary,
    elevator: guide.elevator,
    refs: guide.refs,
    slides: guide.slides,
    pace: guide.pace,
    big: {
      modelTitle: guide.big.modelTitle,
      modelSvg: modelSvg(guide.big.model, guide.big.modelFeedback, guide.big.modelTitle),
      modelNote: guide.big.modelNote,
      tableTitle: guide.big.tableTitle,
      tableHead: guide.big.tableHead,
      rows: guide.big.rows,
      cards: guide.big.cards,
    },
  };

  const values: Record<string, string> = {
    TITLE: esc(`${meta.shortTitle} · Research Study Guide`),
    KICKER: esc(kicker),
    SHORT: esc(meta.shortTitle),
    LOGO: logo,
    H1: esc(meta.title),
    WHO: who,
    CHIPS: chips,
    FOOTNOTE: footnote,
    STORE: `study-guide-${meta.articleId.replace(/[^A-Za-z0-9_-]/g, "")}`,
    DATA: scriptJson(data),
  };
  // One pass, so a placeholder-looking string inside the article text is never expanded.
  return STUDY_GUIDE_TEMPLATE.replace(/\{\{([A-Z0-9]+)\}\}/g, (m, k: string) => (k in values ? values[k] : m));
}
