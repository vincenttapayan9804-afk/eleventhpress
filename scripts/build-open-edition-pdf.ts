/**
 * Builds the downloadable print edition (A4 PDF) of every Open Edition
 * issue from the same content the site renders (src/lib/open-edition.ts),
 * branded and laid out like a printed magazine: cover, contents with page
 * numbers, editors' note and colophon, each article opening on a new page
 * with running heads, the editorial standards, a rights page and a back
 * cover.
 *
 *   bun scripts/build-open-edition-pdf.ts            # every issue
 *   bun scripts/build-open-edition-pdf.ts <issue-id> # one issue
 *
 * Writes each PDF to public<issue.pdf>. Run it whenever an issue's content
 * changes and commit the result (src/lib/open-edition.test.ts checks that
 * every issue has its PDF). Needs Playwright's Chromium (or CHROMIUM_PATH
 * pointing at a Chrome binary), nothing else: no database, no server.
 *
 * Contents page numbers come from a first pass: the PDF is rendered, the
 * page each article opens on is read back with pdf.js, then the edition is
 * rendered again with those numbers filled in.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import {
  OPEN_EDITION_BYLINE,
  OPEN_EDITION_GUIDANCE,
  OPEN_EDITION_PRINCIPLES,
  OPEN_EDITION_PUBLISHER,
  OPEN_EDITION_RIGHTS_DETAIL,
  OPEN_EDITION_ISSUES,
  openEditionCopyright,
  readingMinutes,
  type OpenEditionIssue,
  type OpenEditionPiece,
} from "../src/lib/open-edition";

const ROOT = resolve(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");
const SITE = "https://eleventhpress.com";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A CSS string literal (for @page margin boxes). */
const cssStr = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
const file = (p: string) => pathToFileURL(join(PUBLIC, p)).href;

/**
 * Photos go into the PDF as JPEG: Chromium embeds JPEG data as it is but
 * re-encodes WebP losslessly, which made the edition over 20 MB. Each
 * public image is converted once per build into the scratch folder.
 */
let photoDir = "";
const photoMap = new Map<string, string>();
async function preparePhotos(issue: OpenEditionIssue) {
  const srcs = [issue.cover, ...issue.pieces.map((p) => p.image)];
  for (const src of new Set(srcs)) {
    const out = join(photoDir, `${photoMap.size}.jpg`);
    await sharp(join(PUBLIC, src)).resize({ width: 1800, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
    photoMap.set(src, pathToFileURL(out).href);
  }
}
const photo = (p: string) => photoMap.get(p) ?? file(p);
const pad = (n: number) => String(n).padStart(2, "0");

function issueMonth(issue: OpenEditionIssue) {
  return new Date(`${issue.publishedAt}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function fontFaces(): string {
  const fs = (pkg: string) => pathToFileURL(join(ROOT, "node_modules/@fontsource-variable", pkg, "files")).href;
  const face = (family: string, url: string, style: string, weight: string) =>
    `@font-face{font-family:"${family}";src:url("${url}") format("woff2");font-style:${style};font-weight:${weight};font-display:block;}`;
  return [
    face("Fraunces", `${fs("fraunces")}/fraunces-latin-standard-normal.woff2`, "normal", "100 900"),
    face("Fraunces", `${fs("fraunces")}/fraunces-latin-standard-italic.woff2`, "italic", "100 900"),
    face("Source Serif 4", `${fs("source-serif-4")}/source-serif-4-latin-standard-normal.woff2`, "normal", "200 900"),
    face("Source Serif 4", `${fs("source-serif-4")}/source-serif-4-latin-standard-italic.woff2`, "italic", "200 900"),
    face("Inter", `${fs("inter")}/inter-latin-wght-normal.woff2`, "normal", "100 900"),
    face("Inter", `${fs("inter")}/inter-latin-wght-italic.woff2`, "italic", "100 900"),
    face("JetBrains Mono", `${fs("jetbrains-mono")}/jetbrains-mono-latin-wght-normal.woff2`, "normal", "100 800"),
  ].join("\n");
}

/** Running heads: the issue on front/back matter, the article's own section and title on its pages. */
function pageRules(issue: OpenEditionIssue): string {
  const label = `Vol. ${issue.volume}, No. ${issue.issueNumber} · ${issueMonth(issue)}`;
  const copyright = openEditionCopyright(issue.year);
  const rules = [
    `@page { @top-right { content: ${cssStr(label)}; } @bottom-left { content: ${cssStr(`${copyright}  ·  eleventhpress.com`)}; } }`,
  ];
  issue.pieces.forEach((p, i) => {
    const foot = p.reprint
      ? `Reprinted from ${p.reprint.publication} under ${p.reprint.licence.label}. Not covered by Eleventh Press copyright.`
      : `${copyright}  ·  eleventhpress.com`;
    rules.push(
      `@page piece-${i} { @top-left { content: ${cssStr(`Open Edition · ${p.section}`)}; } @top-right { content: ${cssStr(p.title.length > 64 ? `${p.title.slice(0, 62)}…` : p.title)}; } @bottom-left { content: ${cssStr(foot)}; } }`,
      `.piece-${i} { page: piece-${i}; }`,
    );
  });
  return rules.join("\n");
}

function cover(issue: OpenEditionIssue): string {
  return `<section class="cover sheet" aria-label="Cover">
  <img class="cover-photo" src="${photo(issue.cover)}" alt="${esc(issue.coverAlt)}">
  <div class="cover-mast"><span>Eleventh Press</span><span>Vol. ${issue.volume} · No. ${pad(issue.issueNumber)} · ${esc(issueMonth(issue))}</span></div>
  <div class="cover-logo">Open<i>.</i></div>
  <h1 class="cover-title">${esc(issue.title)} <i>${esc(issue.titleItalic)}</i></h1>
  <p class="cover-line">${esc(issue.coverLine)}<span class="cover-sub">${issue.pieces.filter((p) => p.kind === "original").length} original features · ${issue.pieces.filter((p) => p.kind === "reprint").length} licensed reprints</span></p>
  <div class="cover-bar"><span>FREE ISSUE</span></div>
</section>`;
}

function contents(issue: OpenEditionIssue, pages: number[] | null): string {
  const items = issue.pieces
    .map((p, i) => {
      const by = p.reprint ? `From ${p.reprint.publication}` : `By ${OPEN_EDITION_BYLINE}`;
      return `<li>
  <span class="toc-n">${pad(i + 1)}</span>
  <span>
    <span class="toc-meta">${esc(p.section)}<span class="toc-kind ${p.kind}">${p.kind === "original" ? "Original" : "Reprint"}</span><span class="toc-by">${esc(by)} · ${readingMinutes(p.bodyHtml)} min</span></span>
    <a class="toc-title" href="#${esc(p.slug)}">${esc(p.title)}</a>
    <span class="toc-dek">${esc(p.dek)}</span>
  </span>
  <span class="toc-page">${pages ? pages[i] : "00"}</span>
</li>`;
    })
    .join("\n");
  return `<section class="sheet" aria-labelledby="toc-h">
  <p class="eyebrow">In this issue</p>
  <h2 id="toc-h" class="page-title">Contents</h2>
  <ol class="toc">${items}</ol>
</section>`;
}

function editorsNote(issue: OpenEditionIssue): string {
  return `<section class="sheet" aria-labelledby="note-h">
  <p class="eyebrow">From the editors</p>
  <h2 id="note-h" class="page-title">Welcome to <i>Open Edition</i></h2>
  <div class="note-grid">
    <div class="note">${issue.editorsNote.map((p) => `<p>${esc(p)}</p>`).join("")}<p class="note-sign">The Editors</p></div>
    <aside class="colophon" aria-label="Colophon">
      <div class="mini-logo">Open<i>.</i></div>
      <h3>Issue</h3><p>${esc(issue.series)}, Vol. ${issue.volume}, No. ${issue.issueNumber}<br>${esc(issue.title)} ${esc(issue.titleItalic)}<br>Published ${esc(issueMonth(issue))}</p>
      <h3>Publisher</h3><p>${esc(OPEN_EDITION_PUBLISHER)}™</p>
      <h3>Editorial</h3><p>${esc(OPEN_EDITION_BYLINE)}</p>
      <h3>Read online</h3><p>eleventhpress.com/magazines/${esc(issue.id)}</p>
      <h3>Images</h3><p>Photographs from Unsplash, used under the Unsplash Licence; each is credited under the picture. Charts and illustrations drawn by Eleventh Press from the cited data.</p>
      <h3>Rights</h3><p>${esc(openEditionCopyright(issue.year))} Reprints keep their own open licences; see page “Rights and licences”.</p>
    </aside>
  </div>
</section>`;
}

const STATUS_LABEL = { source: "Checked at source", document: "Checked in source document", reported: "Reported; awaiting confirmation" } as const;

function article(issue: OpenEditionIssue, p: OpenEditionPiece, i: number): string {
  const credit = p.reprint;
  const by = credit ? credit.authors || credit.publisher : OPEN_EDITION_BYLINE;
  const licence = credit
    ? `<div class="licence-box"><p class="eyebrow">Republished under an open licence</p>
<p>From <a href="${esc(credit.sourceUrl)}"><i>${esc(credit.publication)}</i></a>, published by ${esc(credit.publisher)}. Licensed under <a href="${esc(credit.licence.url)}">${esc(credit.licence.label)}</a>. ${esc(credit.notes)}</p>
<p>Eleventh Press is not affiliated with, sponsored by or endorsed by ${esc(credit.publisher)}. This article is not covered by Eleventh Press copyright.</p></div>`
    : "";

  const back = p.kind === "original" && p.sources
    ? `<div class="backmatter">
  <h2>Sources</h2>
  <ol class="sources">${p.sources.map((s, n) => `<li id="${esc(p.refPrefix ?? "")}-s${n + 1}">${s}</li>`).join("")}</ol>
  <aside class="disclosure" aria-label="How this article was made">
    <p class="eyebrow">How this article was made</p>
    <dl>
      <dt>Research</dt><dd>Our editors directed AI-assisted literature mapping to identify and retrieve the official and peer-reviewed sources cited above, and to prepare a first draft.</dd>
      <dt>Verification</dt><dd>Every statistic, quotation and citation was checked against its source and logged claim by claim in the verification log below. Any figure we could not confirm at its original source is labelled as such in the text.</dd>
      <dt>Data visualization</dt><dd>Charts are drawn to scale by Eleventh Press from the cited figures, with the source under each one. No AI-generated images are used.</dd>
      <dt>Accountability</dt><dd>The ${esc(OPEN_EDITION_BYLINE)} reviewed, edited and approved this article and is fully responsible for its content. AI tools are not credited as authors.</dd>
    </dl>
    <p class="basis">Our practice follows the principles of COPE, WAME and the STM guidelines on generative AI. See “Editorial standards” at the back of this issue.</p>
  </aside>
  ${p.verification?.length ? `<div class="vlog"><h2>Verification log · ${p.verification.length} claims checked</h2>
  <table><colgroup><col style="width:38%"><col style="width:16%"><col style="width:20%"><col></colgroup>
  <thead><tr><th>Claim</th><th>Source</th><th>Status</th><th>Note</th></tr></thead>
  <tbody>${p.verification.map((r) => `<tr><td>${esc(r.claim)}</td><td>${esc(r.source)}</td><td><span class="status ${r.status}">${STATUS_LABEL[r.status]}</span></td><td>${esc(r.note)}</td></tr>`).join("")}</tbody></table></div>` : ""}
  <p class="rights-line"><b>${esc(openEditionCopyright(issue.year))}</b> This article is not published under a Creative Commons licence. You may quote brief extracts with credit to ${esc(OPEN_EDITION_PUBLISHER)}; any other reproduction needs our written permission.</p>
</div>`
    : `<p class="rights-line">Reprinted under <b>${esc(credit?.licence.label ?? "")}</b>: you may share and adapt this article under the terms of that licence, crediting ${esc(credit?.publisher ?? "")} as the original publisher.</p>`;

  return `<article id="${esc(p.slug)}" class="sheet piece-${i}" aria-labelledby="${esc(p.slug)}-h">
  <header class="article-head">
    <div class="kicker"><p class="eyebrow">${pad(i + 1)} · ${esc(p.section)}</p><span class="kind ${p.kind}">${p.kind === "original" ? "Original" : "Reprint"}</span></div>
    <h2 id="${esc(p.slug)}-h" class="headline">${esc(p.title)}</h2>
    <p class="dek">${esc(p.dek)}</p>
    <p class="byline"><span>By <b>${esc(by)}</b></span>${credit ? `<span>Republished from <i>${esc(credit.publication)}</i></span>` : ""}<span>${esc(issueMonth(issue))}</span><span>${readingMinutes(p.bodyHtml)} min read</span>${p.dataNote ? `<span>${esc(p.dataNote)}</span>` : ""}</p>
    <figure class="hero"><img src="${photo(p.image)}" alt="${esc(p.imageAlt)}"><figcaption>${esc(p.imageCredit)}</figcaption></figure>
  </header>
  ${licence}
  <div class="prose ${p.kind === "original" ? "dropcap" : ""}">${p.bodyHtml}</div>
  ${back}
</article>`;
}

function standards(): string {
  return `<section class="sheet" aria-labelledby="std-h">
  <p class="eyebrow">Editorial standards</p>
  <h2 id="std-h" class="page-title">How we research, verify and use AI responsibly</h2>
  <p class="lead">Open Edition combines original reporting by the ${esc(OPEN_EDITION_BYLINE)} with openly licensed reprints. These standards apply to every original article. They follow the principles set out by the Committee on Publication Ethics (COPE), the World Association of Medical Editors (WAME) and the STM association’s guidelines on generative AI.</p>
  <div class="principles">${OPEN_EDITION_PRINCIPLES.map((p, i) => `<div class="principle"><p class="n">${pad(i + 1)}</p><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><p class="basis">Basis: ${esc(p.basis)}</p></div>`).join("")}</div>
  <div class="guidance"><p class="eyebrow">Guidance we follow</p><ul>${OPEN_EDITION_GUIDANCE.map((g) => `<li><a href="${esc(g.url)}">${esc(g.label)}</a></li>`).join("")}</ul></div>
</section>`;
}

function rights(issue: OpenEditionIssue): string {
  const reprints = issue.pieces.filter((p) => p.reprint);
  return `<section class="sheet" aria-labelledby="rights-h">
  <p class="eyebrow">Rights and licences</p>
  <h2 id="rights-h" class="page-title">Copyright in this issue</h2>
  <div class="rights-block">
    <h2>Original articles</h2>
    <p class="copyright">${esc(openEditionCopyright(issue.year))}</p>
    <p>${esc(OPEN_EDITION_RIGHTS_DETAIL)}</p>
    <p>This applies to the ${issue.pieces.filter((p) => p.kind === "original").length} articles marked “Original”, the editors’ note, and every chart and illustration drawn by Eleventh Press, including the design of this edition.</p>
  </div>
  <div class="rights-block">
    <h2>Licensed reprints</h2>
    <p>The following articles are reproduced unchanged under the open licence chosen by their publisher. They are not covered by Eleventh Press copyright, and you may reuse them under the terms of their licence.</p>
    <table class="reprint-table"><thead><tr><th>Article</th><th>Source</th><th>Licence</th></tr></thead><tbody>
    ${reprints.map((p) => `<tr><td>${esc(p.title)}</td><td><i>${esc(p.reprint!.publication)}</i>, ${esc(p.reprint!.publisher)}<br><a href="${esc(p.reprint!.sourceUrl)}">${esc(p.reprint!.sourceUrl)}</a></td><td><a href="${esc(p.reprint!.licence.url)}">${esc(p.reprint!.licence.label)}</a></td></tr>`).join("")}
    </tbody></table>
  </div>
  <div class="rights-block">
    <h2>Images and names</h2>
    <p>Photographs are used under the Unsplash Licence and are not covered by any Creative Commons licence in this issue. Publication names identify the source of each reprint; Eleventh Press is not affiliated with, sponsored by or endorsed by those publishers.</p>
  </div>
</section>`;
}

function backCover(issue: OpenEditionIssue): string {
  const url = `${SITE}/magazines/${issue.id}`;
  return `<section class="back sheet" aria-label="Back cover">
  <div class="back-logo">Open<i>.</i></div>
  <p class="back-copy">Each issue of <em>Open Edition</em> takes one theme and brings together original features researched by our editorial team and the best openly licensed journalism. Every figure links to its source; every reprint carries its licence.</p>
  <div class="back-read"><b>Read this issue online</b><a href="${esc(url)}">eleventhpress.com/magazines/${esc(issue.id)}</a></div>
  <div class="back-foot">
    <div class="back-brand">${esc(OPEN_EDITION_PUBLISHER)}™<span>${esc(issue.series)} · Vol. ${issue.volume}, No. ${issue.issueNumber} · ${esc(issueMonth(issue))}</span></div>
    <div>${esc(openEditionCopyright(issue.year))}<br>Free to read. Not for resale.</div>
  </div>
</section>`;
}

function editionHtml(issue: OpenEditionIssue, pages: number[] | null): string {
  const css = readFileSync(join(import.meta.dir, "open-edition-pdf/print.css"), "utf8");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(`${issue.series} — ${issue.title} ${issue.titleItalic} (Vol. ${issue.volume}, No. ${issue.issueNumber})`)}</title>
<meta name="author" content="${esc(OPEN_EDITION_PUBLISHER)}">
<meta name="description" content="${esc(issue.description)}">
<style>${fontFaces()}\n${css}\n${pageRules(issue)}</style></head><body>
${cover(issue)}
${contents(issue, pages)}
${editorsNote(issue)}
${issue.pieces.map((p, i) => article(issue, p, i)).join("\n")}
${standards()}
${rights(issue)}
${backCover(issue)}
</body></html>`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** 1-based page on which each piece's headline appears (searching after the contents). */
async function findPiecePages(pdf: Uint8Array, issue: OpenEditionIssue): Promise<number[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdf, useSystemFonts: true }).promise;
  const texts: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    texts.push(norm(tc.items.map((it) => ("str" in it ? it.str : "")).join(" ")));
  }
  let from = 3; // cover, contents, editors' note
  return issue.pieces.map((p) => {
    // Headlines can be shortened in the running head, so match the start of the headline.
    const key = norm(p.title).slice(0, 40);
    const idx = texts.findIndex((t, k) => k >= from && t.includes(key));
    if (idx < 0) throw new Error(`Could not find the opening page of "${p.title}"`);
    from = idx + 1;
    return idx + 1;
  });
}

async function build(issue: OpenEditionIssue) {
  const work = mkdtempSync(join(tmpdir(), "oe-pdf-"));
  photoDir = work;
  photoMap.clear();
  await preparePhotos(issue);
  // CHROMIUM_PATH lets a machine use a preinstalled browser instead of Playwright's own download.
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage();
    const render = async (pages: number[] | null) => {
      const htmlPath = join(work, `${issue.id}.html`);
      writeFileSync(htmlPath, editionHtml(issue, pages));
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      return page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
    };
    const draft = await render(null);
    const pages = await findPiecePages(new Uint8Array(draft), issue);
    const finalPdf = await render(pages);
    const check = await findPiecePages(new Uint8Array(finalPdf), issue);
    if (check.join() !== pages.join()) throw new Error(`Page numbers moved between passes: ${pages} vs ${check}`);

    const out = join(PUBLIC, issue.pdf);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, finalPdf);
    const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
    console.log(`${issue.id}: ${issue.pdf} (${mb} MB), articles open on pages ${pages.join(", ")}`);
  } finally {
    await browser.close();
  }
}

const only = process.argv[2];
const targets = only ? OPEN_EDITION_ISSUES.filter((i) => i.id === only) : OPEN_EDITION_ISSUES;
if (!targets.length) {
  console.error(`No Open Edition issue with id "${only}"`);
  process.exit(1);
}
for (const issue of targets) await build(issue);
