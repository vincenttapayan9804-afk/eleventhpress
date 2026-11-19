/**
 * Galley generation service — calls Pandoc + WeasyPrint directly.
 *
 * This replaces the separate mini-service approach with in-process
 * child_process calls, which is more reliable in sandboxed environments.
 *
 * In production, this would be a separate worker container consuming
 * jobs from a Kafka queue, calling Pandoc + LaTeX/WeasyPrint, and
 * writing galleys to S3.
 */
// Must be imported before pdfjs-dist — see the file itself for why.
import "./pdfjs-node-polyfill";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import mammoth from "mammoth";
// @ts-ignore — pdfjs-dist ships types for its ESM entry but not always
// resolved cleanly under this project's moduleResolution; the runtime
// import is what matters here.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import WordExtractor from "word-extractor";
import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import { putObject } from "@/lib/storage";
import { buildEpub } from "@/lib/epub-builder";
import { parseAuthors } from "@/lib/article";
import { ARTICLE_LANGUAGE, JOURNAL_IDENTITY } from "@/lib/site";
import { POWERED_BY_CREDIT } from "@/lib/powered-by";
import { withTrademark } from "@/lib/brand-mark";
import { registerGalleyFonts, printable, renderBody, htmlToBlocks, pdfArtifact, pdfStructureRoot, pdfTag, type Run } from "@/lib/galley-pdf";

const PLATFORM_PUBLISHER_NAME = JOURNAL_IDENTITY.name;

// Manuscript content embedded in reader-facing pages (the HTML galley and
// the public article page) must be sanitized — a malicious "manuscript"
// upload (.html, .tex-as-html, or a crafted docx) is otherwise a stored-XSS
// vector against every visitor of a published article.
const MANUSCRIPT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
    "strong", "b", "em", "i", "u", "s", "br", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
    "blockquote", "a", "sup", "sub", "code", "pre", "figure", "figcaption", "img",
  ],
  allowedAttributes: { a: ["href"], img: ["src", "alt"] },
  allowedSchemes: ["http", "https", "mailto"],
  // Figures in a Word manuscript arrive as inline data: images (mammoth);
  // without this they were silently dropped from every galley. An <img> can't
  // run script, whatever its data type.
  allowedSchemesByTag: { img: ["data", "http", "https"] },
};

// Vercel serverless functions ship a read-only deployment bundle — only
// os.tmpdir() (/tmp) is writable at runtime. A project-relative path here
// throws EROFS on every publish, which the caller swallows into a silent
// placeholder-galley fallback (dead download links) rather than a visible
// error.
const TEMP_DIR = path.join(os.tmpdir(), "epip-galley");

/** Brand inputs for a galley — the publishing tenant's identity, or the platform's. */
export interface GalleyBrand {
  /** Publisher printed in the masthead/footer and JATS <publisher-name>. */
  publisher?: string;
  /** True for a whitelabel tenant's journal. */
  whitelabel?: boolean;
  primaryHex?: string;
  accentHex?: string;
  /** Tenant logo, already converted to PNG (PDF masthead only). */
  logoPng?: Buffer | null;
  /** Online ISSN, printed beside the ISSN when the tenant set one. */
  eissn?: string | null;
  /** ISO 4 abbreviated title for JATS <abbrev-journal-title>. */
  abbreviation?: string | null;
}

function brandOf(meta: GalleyBrand & { issn?: string }) {
  return {
    publisher: withTrademark(meta.publisher) || PLATFORM_PUBLISHER_NAME,
    whitelabel: !!meta.whitelabel,
    primary: meta.primaryHex || BRAND_PURPLE,
    accent: meta.accentHex || BRAND_GOLD,
    issn: (meta.issn || "").trim(),
    eissn: (meta.eissn || "").trim(),
    abbreviation: (meta.abbreviation || "").trim(),
    /** Fixed platform credit on every whitelabel galley; null on the platform's own. */
    credit: meta.whitelabel ? POWERED_BY_CREDIT : null,
  };
}

/** "ISSN xxxx · e-ISSN yyyy" (either omitted when unset). */
function issnText(b: ReturnType<typeof brandOf>): string {
  return [b.issn && `ISSN ${b.issn}`, b.eissn && `e-ISSN ${b.eissn}`].filter(Boolean).join(" · ");
}

/** "Publisher — ISSN xxxx" (ISSN omitted when the journal has none). */
function footerLine(meta: GalleyBrand & { issn?: string }): string {
  const b = brandOf(meta);
  const issns = issnText(b);
  return issns ? `${b.publisher} — ${issns}` : b.publisher;
}

function cssString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

function galleyCss(meta: GalleyBrand & { issn?: string }): string {
  const b = brandOf(meta);
  return EPIP_CSS.replace(/#4c1d95/g, b.primary)
    .replace(/#c9a55c/g, b.accent)
    .replace("__EPIP_FOOTER__", cssString(b.credit ? `${footerLine(meta)} · ${b.credit}` : footerLine(meta)));
}

const EPIP_CSS = `
@page {
  size: A4;
  margin: 25mm 22mm 25mm 22mm;
  @bottom-center {
    content: "__EPIP_FOOTER__";
    font-family: Georgia, serif;
    font-size: 8pt;
    color: #4c1d95;
  }
  @bottom-right { content: counter(page); font-family: sans-serif; font-size: 8pt; }
}
body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #241b3a; }
h1 { font-size: 20pt; color: #4c1d95; border-bottom: 1px solid #c9a55c; padding-bottom: 0.3em; }
h2 { font-size: 14pt; color: #4c1d95; margin-top: 1.5em; }
h3 { font-size: 12pt; color: #3a1668; }
p { text-align: justify; text-indent: 1.5em; margin: 0 0 0.6em; }
.abstract { background: #f7f3fc; border-left: 3px solid #c9a55c; padding: 1em 1.5em; margin: 1em 0; font-size: 10pt; }
.abstract p { text-indent: 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 0.4em; font-size: 10pt; }
th { background: #f7f3fc; color: #4c1d95; }
code { font-family: monospace; font-size: 9pt; background: #f4f0e8; padding: 0.1em 0.3em; }
a { color: #4c1d95; overflow-wrap: anywhere; }
img { max-width: 100%; height: auto; }
figure { margin: 1.2em 0; text-align: center; }
figcaption { font-size: 9pt; font-style: italic; color: #555; margin-top: 0.4em; }
ul, ol { padding-left: 1.6em; margin: 0.4em 0 0.8em; }
li { margin: 0.2em 0; }
li p, td p, th p, blockquote p { text-indent: 0; }
h1 + p, h2 + p, h3 + p, h4 + p { text-indent: 0; }
blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 3px solid #c9a55c; color: #3d3550; }
pre { white-space: pre-wrap; font-size: 9pt; background: #f4f0e8; padding: 0.6em; }
@media screen {
  body { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; overflow-wrap: break-word; }
  .table-wrap, .article-body table { display: block; overflow-x: auto; }
}
`;

export interface GalleyResult {
  htmlKey: string;
  pdfKey: string;
  jatsKey: string | null;
  epubKey: string | null;
  log: string[];
}

function runCommand(cmd: string, args: string[], cwd: string, timeout = 30000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ stdout, stderr: stderr + "\n[timeout]", code: 124 });
    }, timeout);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 0 });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + "\n" + e.message, code: -1 });
    });
  });
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Collapses copy-pasted whitespace runs (tabs, repeated spaces, stray
 * newlines) into single spaces — submitted titles/abstracts often carry
 * this from Word/Docs paste and it renders as visible garbage otherwise. */
function normalizeWhitespace(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function escapeXml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** Wraps blank-line-delimited plain text into paragraphs, HTML-escaped. */
function plainTextToHtml(text: string): string | null {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return paragraphs.map((p) => `<p>${escapeXml(p)}</p>`).join("\n");
}

/**
 * Rebuilds paragraphs from a PDF's hard-wrapped lines: a line that ends a
 * sentence well short of the column width ends its paragraph, and a short
 * title-like line ("Methods", "2.1 Study Site") stands on its own so the
 * galley can set it as a heading. Hyphenated line ends are rejoined.
 */
export function linesToParagraphs(text: string): string {
  const out: string[] = [];
  for (const page of text.split(/\n{2,}/)) {
    const lines = page.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!lines.length) continue;
    const sorted = lines.map((l) => l.length).sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length * 0.75)] || 80;
    let cur = "";
    const flush = () => {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    };
    for (const line of lines) {
      const short = line.length < typical * 0.7;
      const titleLike = short && line.length < 80 && !/[.,;:]$/.test(line) && /^([0-9IVX]+(\.[0-9]+)*\.?\s+)?[A-Z]/.test(line) && line.split(" ").length <= 10;
      if (titleLike && !cur.endsWith("-")) {
        flush();
        out.push(line);
        continue;
      }
      cur = cur.endsWith("-") && /^[a-z]/.test(line) ? cur.slice(0, -1) + line : cur ? `${cur} ${line}` : line;
      if (short && /[.!?:”")]$/.test(line)) flush();
    }
    flush();
  }
  return out.join("\n\n");
}

/** Minimal LaTeX → readable-text stripping — not a full LaTeX renderer,
 * just enough to surface the actual written content instead of raw
 * commands (\section, \textbf, comments, preamble). */
function stripLatexToText(tex: string): string {
  return tex
    .replace(/%.*$/gm, "") // comments
    .replace(/\\(documentclass|usepackage|input|include)\{[^}]*\}/g, "")
    .replace(/\\begin\{document\}/g, "").replace(/\\end\{document\}/g, "")
    .replace(/\\(section|subsection|subsubsection)\*?\{([^}]*)\}/g, "\n\n$2\n")
    .replace(/\\(textbf|textit|emph)\{([^}]*)\}/g, "$2")
    .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "") // remaining commands
    .replace(/[{}]/g, "");
}

/**
 * Extracts the manuscript's real body content as sanitized HTML, format by
 * format, entirely in-process (pure JS — no pandoc/LaTeX/system binaries,
 * which aren't available on Vercel). Returns null when the format isn't
 * recognized or extraction fails, in which case the caller falls back to a
 * metadata-only page rather than a broken one.
 */
/** Extracts plain text from a PDF manuscript via pdfjs-dist (the same
 * engine behind Firefox's PDF viewer) — pure JS/WASM, no system binaries,
 * so it works on Vercel's serverless runtime. */
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      verbosity: pdfjsLib.VerbosityLevel.ERRORS, // suppress non-fatal font warnings
    });
    const doc = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Keep the PDF's own line ends, so paragraphs can be rebuilt from them.
      pageTexts.push(content.items.map((item: any) => (item.str || "") + (item.hasEOL ? "\n" : " ")).join(""));
    }
    await loadingTask.destroy();
    return pageTexts.join("\n\n") || null;
  } catch {
    return null;
  }
}

export async function extractManuscriptBody(buffer: Buffer, filename: string): Promise<string | null> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  try {
    if (ext === "docx") {
      const result = await mammoth.convertToHtml({ buffer });
      const html = sanitizeHtml(result.value, MANUSCRIPT_SANITIZE_OPTIONS).trim();
      return html || null;
    }
    if (ext === "doc") {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      return plainTextToHtml(doc.getBody());
    }
    if (ext === "pdf") {
      const text = await extractPdfText(buffer);
      return text ? plainTextToHtml(linesToParagraphs(text)) : null;
    }
    if (ext === "md" || ext === "markdown") {
      const html = sanitizeHtml(await marked.parse(buffer.toString("utf-8")), MANUSCRIPT_SANITIZE_OPTIONS).trim();
      return html || null;
    }
    if (ext === "html" || ext === "htm") {
      const html = sanitizeHtml(buffer.toString("utf-8"), MANUSCRIPT_SANITIZE_OPTIONS).trim();
      return html || null;
    }
    if (ext === "tex") {
      return plainTextToHtml(stripLatexToText(buffer.toString("utf-8")));
    }
    if (ext === "txt") {
      return plainTextToHtml(buffer.toString("utf-8"));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Generate HTML, PDF, and JATS galleys from a manuscript.
 */
export async function generateGalleys(
  manuscriptContent: Buffer,
  manuscriptName: string,
  meta: {
    id: string;
    title: string;
    authors: string; // JSON
    abstract: string;
    keywords: string;
    discipline: string;
    doi: string;
    journalName: string;
    issn: string;
    volume: number;
    issue: number;
    year: number;
  } & GalleyBrand
): Promise<GalleyResult> {
  // Submitted titles/abstracts often carry copy-pasted whitespace (tabs,
  // repeated spaces, trailing newlines from Word/Docs) that renders as
  // visible garbage in the galley — collapse it once, up front, so every
  // downstream render (masthead, PDF body, HTML) sees clean text.
  meta = {
    ...meta,
    title: normalizeWhitespace(meta.title),
    abstract: normalizeWhitespace(meta.abstract),
    keywords: normalizeWhitespace(meta.keywords),
  };

  const log: string[] = [];
  const jobId = crypto.randomBytes(6).toString("hex");
  log.push(`[${new Date().toISOString()}] Starting galley generation job ${jobId}`);

  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Only the extension is taken from manuscriptName, and only if it looks
  // like a plausible extension — this is a second layer on top of the
  // caller-side sanitization in src/lib/storage.ts's safeManuscriptFilename()
  // and src/app/api/articles/submit/route.ts, not a replacement for it:
  // manuscriptName here is ultimately derived from a storage key
  // (article.manuscriptKey?.split("/").pop()), and a future caller of
  // generateGalleys() should never be able to reintroduce a traversal by
  // passing an unsanitized name directly.
  const rawExt = manuscriptName.split(".").pop()?.toLowerCase() || "md";
  const ext = /^[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : "md";
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- `ext` is validated against a strict [a-z0-9]{1,10} allowlist directly above; semgrep's taint tracking doesn't model that regex-test as sanitization.
  const inputPath = path.join(TEMP_DIR, `${jobId}-input.${ext}`);
  await fs.writeFile(inputPath, manuscriptContent);
  log.push(`Wrote input: ${inputPath} (${manuscriptContent.length} bytes)`);

  // Write CSS
  const cssPath = path.join(TEMP_DIR, "epip.css");
  await fs.writeFile(cssPath, galleyCss(meta));

  // Build YAML metadata
  const authors = JSON.parse(meta.authors || "[]");
  const yamlPath = path.join(TEMP_DIR, `${jobId}-meta.yaml`);
  const yaml = `---
title: "${meta.title.replace(/"/g, '\\"')}"
author:
${authors.map((a: any) => `  - name: "${a.name}"\n    affiliation: "${a.affiliation || ""}"`).join("\n")}
abstract: "${meta.abstract.replace(/"/g, '\\"').replace(/\n/g, " ").slice(0, 2000)}"
doi: "${meta.doi}"
journal: "${meta.journalName}"
issn: "${meta.issn}"
volume: ${meta.volume}
issue: ${meta.issue}
year: ${meta.year}
---
`;
  await fs.writeFile(yamlPath, yaml);

  let htmlContent = "";
  let pdfBuffer: Buffer | null = null;
  let jatsContent = "";
  // Holds *only* the manuscript's real body content (never the full page
  // with masthead/title/authors/abstract/keywords already rendered as
  // their own PDF sections above it) — feeding the full page in here would
  // duplicate all of that. Empty means metadata-only (nothing to add).
  let pdfBodySource = "";

  // Extract the manuscript's real body content in-process (pure JS — no
  // pandoc/LaTeX/system binaries, which aren't available on Vercel). Runs
  // regardless of Pandoc's own attempt below so it's ready as the primary
  // fallback the moment Pandoc is unavailable, rather than a metadata-only
  // page pretending nothing was submitted.
  const extractedBody = await extractManuscriptBody(manuscriptContent, manuscriptName);
  log.push(extractedBody ? `Extracted real manuscript body (${extractedBody.length} chars, .${ext})` : `No body extracted for .${ext} — will use metadata-only page if Pandoc is also unavailable`);

  // 1. HTML galley via Pandoc
  try {
    const htmlPath = path.join(TEMP_DIR, `${jobId}.html`);
    const r = await runCommand("pandoc", [
      inputPath, "--metadata-file", yamlPath,
      "-s", "--to", "html5", "--standalone",
      "--css", "epip.css", "--embed-resources",
      "--output", htmlPath, "--wrap=none",
    ], TEMP_DIR, 30000);
    log.push(`pandoc HTML: exit ${r.code}${r.stderr ? " | " + r.stderr.slice(0, 200) : ""}`);

    if (r.code === 0 && await fileExists(htmlPath)) {
      const pandocBody = await fs.readFile(htmlPath, "utf-8");
      htmlContent = injectBrand(pandocBody, meta);
      pdfBodySource = pandocBody;
    } else if (extractedBody) {
      htmlContent = buildFallbackHtml(meta, extractedBody);
      pdfBodySource = extractedBody;
      log.push("HTML galley built from extracted manuscript body");
    } else {
      // Last resort — Pandoc unavailable AND the format has no in-process
      // extractor (or extraction failed): same branding, metadata only.
      htmlContent = buildFallbackHtml(meta);
      log.push("HTML galley built via metadata-only fallback");
    }
  } catch (e: any) {
    log.push(`HTML error: ${e.message}`);
    htmlContent = extractedBody ? buildFallbackHtml(meta, extractedBody) : buildFallbackHtml(meta);
    pdfBodySource = extractedBody || "";
  }

  // 2. PDF galley via WeasyPrint, when available (higher-fidelity HTML/CSS
  // rendering — typically only present in a local dev environment with the
  // binary installed).
  try {
    if (htmlContent) {
      const htmlForPdf = path.join(TEMP_DIR, `${jobId}-for-pdf.html`);
      await fs.writeFile(htmlForPdf, htmlContent);
      const pdfPath = path.join(TEMP_DIR, `${jobId}.pdf`);
      const r = await runCommand("weasyprint", [htmlForPdf, pdfPath], TEMP_DIR, 45000);
      log.push(`weasyprint PDF: exit ${r.code}${r.stderr ? " | " + r.stderr.slice(0, 200) : ""}`);
      if (r.code === 0 && await fileExists(pdfPath)) {
        pdfBuffer = await fs.readFile(pdfPath);
      }
    }
  } catch (e: any) {
    log.push(`PDF error: ${e.message}`);
  }

  // WeasyPrint isn't installed on Vercel's serverless runtime (no system
  // binaries), so this is the actual production path: a real PDF built
  // in-process with PDFKit (pure JS, no native dependencies) instead of a
  // placeholder file.
  if (!pdfBuffer) {
    try {
      pdfBuffer = await renderPdfKitGalley(meta, pdfBodySource);
      log.push(`PDF galley built via in-process PDFKit renderer (${pdfBuffer.length} bytes)`);
    } catch (e: any) {
      log.push(`PDFKit error: ${e.message}`);
    }
  }

  // 3. JATS XML via Pandoc (or fallback)
  try {
    const jatsPath = path.join(TEMP_DIR, `${jobId}.jats.xml`);
    const r = await runCommand("pandoc", [
      inputPath, "--metadata-file", yamlPath,
      "-s", "--to", "jats_article", "--output", jatsPath,
    ], TEMP_DIR, 30000);
    log.push(`pandoc JATS: exit ${r.code}${r.stderr ? " | " + r.stderr.slice(0, 200) : ""}`);
    if (r.code === 0 && await fileExists(jatsPath)) {
      jatsContent = await fs.readFile(jatsPath, "utf-8");
    } else {
      jatsContent = buildFallbackJats(meta, extractedBody);
      log.push("JATS built via fallback");
    }
  } catch (e: any) {
    jatsContent = buildFallbackJats(meta, extractedBody);
    log.push(`JATS error: ${e.message}, using fallback`);
  }

  // Write galleys to storage
  // Keyed by the article id, never the DOI's last segment ("…2026.48213"):
  // that number is not unique across journals, and two articles sharing it
  // would overwrite each other's galleys.
  const htmlKey = `published-galleys/${meta.id}.html`;
  const pdfKey = `published-galleys/${meta.id}.pdf`;
  const jatsKey = `published-galleys/${meta.id}.jats.xml`;
  const epubKey = `published-galleys/${meta.id}.epub`;

  await putObject(htmlKey, Buffer.from(htmlContent, "utf-8"), "text/html; charset=utf-8");
  log.push(`Stored HTML: ${htmlKey} (${htmlContent.length} chars)`);

  if (!pdfBuffer) {
    // Last-resort path — only reached if the PDFKit renderer itself threw.
    // Still a real, openable PDF (not a mislabeled text file).
    pdfBuffer = await renderMinimalErrorPdf(meta);
    log.push("PDF galley built via minimal error-fallback PDF");
  }
  await putObject(pdfKey, pdfBuffer, "application/pdf");
  log.push(`Stored PDF: ${pdfKey} (${pdfBuffer.length} bytes)`);

  if (jatsContent) {
    await putObject(jatsKey, Buffer.from(jatsContent, "utf-8"), "application/xml");
    log.push(`Stored JATS: ${jatsKey} (${jatsContent.length} chars)`);
  }

  // 4. EPUB3 — reuses the same single-chapter shape src/lib/epub-builder.ts
  // was built for (originally book chapters); `pdfBodySource` is the same
  // real extracted/Pandoc body already used for the PDF, so this never
  // duplicates the masthead/title/abstract that injectBrand() adds to
  // htmlContent for the HTML/PDF galleys.
  let epubResultKey: string | null = null;
  try {
    const epubAuthorNames = parseAuthors(meta.authors).map((a) => a.name).filter(Boolean);
    const body = pdfBodySource ? stripBodyForEpub(pdfBodySource) : "";
    const chapterHtml = epubFrontMatter(meta) + (body || "");
    const eb = brandOf(meta);
    const epubBuffer = buildEpub(
      {
        id: meta.id,
        title: meta.title,
        subtitle: null,
        authors: epubAuthorNames,
        rights: buildLicenseNotice(meta),
        publisher: eb.publisher,
        credit: eb.credit,
        doi: meta.doi || null,
        css: epubCss(eb.primary, eb.accent),
      },
      [{ title: meta.title, html: chapterHtml }]
    );
    await putObject(epubKey, epubBuffer, "application/epub+zip");
    epubResultKey = epubKey;
    log.push(`Stored EPUB: ${epubKey} (${epubBuffer.length} bytes)`);
  } catch (e: any) {
    log.push(`EPUB error: ${e.message}`);
  }

  // Cleanup temp files
  try {
    const temps = await fs.readdir(TEMP_DIR);
    for (const f of temps) {
      if (f.startsWith(jobId)) await fs.unlink(path.join(TEMP_DIR, f)).catch(() => {});
    }
  } catch {}

  log.push(`[${new Date().toISOString()}] Job ${jobId} complete`);
  return { htmlKey, pdfKey, jatsKey, epubKey: epubResultKey, log };
}

/** Pandoc output is a whole page; an EPUB chapter needs only what's inside <body>. */
function stripBodyForEpub(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const inner = (m ? m[1] : html).replace(/<header[\s\S]*?<\/header>/gi, "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").trim();
  // The chapter's own <h1> is the article title; manuscript headings move one level down.
  return /<h1[\s>]/i.test(inner) ? inner.replace(/<(\/?)h([1-5])(?=[\s>])/gi, (_m, slash: string, n: string) => `<${slash}h${Number(n) + 1}`) : inner;
}

/** Authors, affiliations, journal line, abstract, keywords and licence at the top of the EPUB. */
function epubFrontMatter(meta: any): string {
  const b = brandOf(meta);
  const authors = safeParseAuthors(meta.authors).filter((a: any) => a?.name);
  const affiliations: string[] = Array.from(new Set(authors.map((a: any) => a.affiliation).filter(Boolean)));
  const numbered = affiliations.length > 1;
  const names = authors
    .map((a: any) => escapeXml(a.name) + (numbered && a.affiliation ? `<sup>${affiliations.indexOf(a.affiliation) + 1}</sup>` : ""))
    .join(", ");
  const journal = [escapeXml(meta.journalName || ""), `Vol. ${escapeXml(String(meta.volume))}, No. ${escapeXml(String(meta.issue))} (${escapeXml(String(meta.year))})`, issnText(b) ? escapeXml(issnText(b)) : ""]
    .filter(Boolean)
    .join(" · ");
  return `<section class="front">
<p class="journal">${journal}</p>
${names ? `<p class="authors">${names}</p>` : ""}
${affiliations.length ? `<p class="affiliations">${affiliations.map((a, i) => `${numbered ? `<sup>${i + 1}</sup> ` : ""}${escapeXml(a)}`).join("<br/>")}</p>` : ""}
${meta.doi ? `<p class="doi">DOI: <a href="https://doi.org/${escapeXml(meta.doi)}">${escapeXml(meta.doi)}</a></p>` : ""}
<div class="abstract"><p class="label">Abstract</p><p>${escapeXml(meta.abstract || "")}</p>${meta.keywords ? `<p class="keywords"><strong>Keywords:</strong> ${escapeXml(meta.keywords)}</p>` : ""}</div>
<p class="licence">© ${escapeXml(String(meta.year))} the authors. Open access under the Creative Commons Attribution 4.0 International licence (CC BY 4.0).</p>
</section>
`;
}

function epubCss(primary: string, accent: string): string {
  return `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.55; margin: 0 4%; color: #1f1a2e; }
h1 { font-size: 1.5em; color: ${primary}; line-height: 1.25; margin: 0.6em 0 0.4em; }
h2 { font-size: 1.2em; color: ${primary}; margin-top: 1.4em; }
h3 { font-size: 1.05em; margin-top: 1.2em; }
p { margin: 0 0 0.7em; text-align: justify; }
a { color: ${primary}; word-wrap: break-word; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.85em; margin: 1em 0; }
th, td { border-bottom: 1px solid #cfcbd8; padding: 0.3em 0.4em; text-align: left; vertical-align: top; }
th { color: ${primary}; border-bottom: 2px solid ${primary}; }
blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid ${accent}; }
.front { margin-bottom: 1.5em; }
.front .journal { font-size: 0.8em; color: #5f5873; }
.front .authors { font-weight: bold; margin-bottom: 0.2em; }
.front .affiliations { font-size: 0.8em; font-style: italic; color: #5f5873; }
.front .doi, .front .licence { font-size: 0.8em; color: #5f5873; }
.abstract { background: #f6f4fa; border-left: 3px solid ${accent}; padding: 0.6em 0.9em; margin: 1em 0; }
.abstract .label { font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75em; color: ${primary}; margin: 0 0 0.3em; }
.abstract .keywords { font-size: 0.85em; margin: 0.5em 0 0; }
`;
}

function injectBrand(html: string, meta: any): string {
  const b = brandOf(meta);
  const issnPart = issnText(b) ? `${escapeXml(issnText(b))} · ` : "";
  const header = `
<header style="border-bottom: 2px solid ${b.primary}; padding: 1em 0; margin-bottom: 2em;">
  <div style="font-family: sans-serif; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; color: ${b.accent}; font-weight: 600;">${escapeXml(b.publisher)}</div>
  <div style="font-family: Georgia, serif; font-size: 1.1rem; color: ${b.primary}; font-weight: 600; margin-top: 0.2em;">${escapeXml(meta.journalName)}</div>
  <div style="font-size: 0.75rem; color: #666; margin-top: 0.2em;">${issnPart}Vol. ${meta.volume}, Iss. ${meta.issue} (${meta.year}) · DOI: <a href="https://doi.org/${escapeXml(meta.doi)}">${escapeXml(meta.doi)}</a></div>
</header>`;
  const withHeader = html.replace(/<body>/, `<body>${header}`);
  if (!b.credit) return withHeader;
  const footer = `
<footer style="border-top: 1px solid ${b.primary}; margin-top: 3em; padding-top: 0.8em; font-family: sans-serif; font-size: 0.7rem; color: #666; text-align: center;">${escapeXml(b.publisher)} · ${escapeXml(b.credit)}</footer>`;
  return withHeader.includes("</body>") ? withHeader.replace(/<\/body>/, `${footer}</body>`) : withHeader + footer;
}

/** Branded HTML galley used whenever Pandoc isn't available — the actual
 * production path on Vercel (no system binaries there), so it needs the
 * same masthead/styling as the Pandoc-success path rather than a bare
 * unstyled shell. */
/** Branded HTML galley used whenever Pandoc isn't available — the actual
 * production path on Vercel (no system binaries there). `bodyHtml`, when
 * provided, is the manuscript's real extracted content (already sanitized
 * by extractManuscriptBody); without it this renders metadata only. */
function buildFallbackHtml(meta: any, bodyHtml?: string | null): string {
  const authors = safeParseAuthors(meta.authors).filter((a: any) => a?.name);
  const affiliations: string[] = Array.from(new Set(authors.map((a: any) => a.affiliation).filter(Boolean)));
  const numbered = affiliations.length > 1;
  const authorLine = authors
    .map((a: any) => escapeXml(a.name) + (numbered && a.affiliation ? `<sup>${affiliations.indexOf(a.affiliation) + 1}</sup>` : ""))
    .join(", ");
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(meta.title)}</title>
${meta.doi ? `<meta name="citation_doi" content="${escapeXml(meta.doi)}">` : ""}
<style>${galleyCss(meta)}</style>
</head>
<body>
<h1>${escapeXml(meta.title)}</h1>
${authorLine ? `<p><strong>${authorLine}</strong></p>` : ""}
${affiliations.length ? `<p style="font-size: 0.85em; color: #555; text-indent: 0;">${affiliations.map((a, i) => `${numbered ? `<sup>${i + 1}</sup> ` : ""}${escapeXml(a)}`).join("<br>")}</p>` : ""}
<div class="abstract"><p>${escapeXml(meta.abstract)}</p></div>
${meta.keywords ? `<p><em>Keywords: ${escapeXml(meta.keywords)}</em></p>` : ""}
${bodyHtml ? `<div class="article-body">${bodyHtml}</div>` : ""}
</body>
</html>`;
  return injectBrand(doc, meta);
}

function jatsInline(runs: Run[]): string {
  return runs
    .map((r) => {
      let x = escapeXml(r.text).replace(/\n/g, " ");
      if (r.code) x = `<monospace>${x}</monospace>`;
      if (r.sup) x = `<sup>${x}</sup>`;
      if (r.sub) x = `<sub>${x}</sub>`;
      if (r.italic) x = `<italic>${x}</italic>`;
      if (r.bold) x = `<bold>${x}</bold>`;
      if (r.link) x = `<ext-link ext-link-type="uri" xlink:href="${escapeXml(r.link)}">${x}</ext-link>`;
      return x;
    })
    .join("");
}

const JATS_REF_HEADING = /^(\d+(\.\d+)*\.?\s+)?(references?|bibliography|works cited|literature cited|reference list)\s*:?$/i;

/**
 * JATS 1.3 body + back built from the manuscript: headings open <sec>s,
 * lists/tables/quotes keep their structure, and the paragraphs under a
 * "References" heading become the real <ref-list> (one <mixed-citation> each).
 */
export function buildJatsBodyAndBack(bodyHtml: string, skip: string[] = []): { body: string; back: string } {
  const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
  const skipSet = new Set(skip.filter(Boolean).map(norm));
  const blocks = htmlToBlocks(bodyHtml);
  while (blocks.length && blocks[0].kind === "para" && skipSet.has(norm((blocks[0] as any).runs.map((r: Run) => r.text).join("")))) blocks.shift();

  const out: string[] = [];
  const refs: string[] = [];
  let open = 0;
  let secN = 0;
  let inRefs = false;
  const textOf = (runs: Run[]) => runs.map((r) => r.text).join("").trim();
  for (const b of blocks) {
    if (b.kind === "heading" || (b.kind === "para" && JATS_REF_HEADING.test(textOf(b.runs)))) {
      const title = textOf(b.runs);
      if (JATS_REF_HEADING.test(title)) {
        inRefs = true;
        continue;
      }
      inRefs = false;
      const level = b.kind === "heading" ? Math.max(1, Math.min(b.level, 4)) : 1;
      // Close deeper or equal sections, then open this one.
      while (open >= level) {
        out.push("</sec>");
        open--;
      }
      while (open < level - 1) {
        out.push(`<sec id="s${++secN}">`);
        open++;
      }
      out.push(`<sec id="s${++secN}"><title>${jatsInline(b.runs)}</title>`);
      open++;
      continue;
    }
    if (inRefs) {
      const items = b.kind === "para" ? [b.runs] : b.kind === "list" ? b.items.map((i) => i.runs) : [];
      for (const runs of items) if (textOf(runs)) refs.push(`<ref id="ref${refs.length + 1}"><mixed-citation>${jatsInline(runs)}</mixed-citation></ref>`);
      continue;
    }
    switch (b.kind) {
      case "para":
        out.push(`<p>${jatsInline(b.runs)}</p>`);
        break;
      case "list":
        out.push(`<list list-type="${b.ordered ? "order" : "bullet"}">${b.items.map((i) => `<list-item><p>${jatsInline(i.runs)}</p></list-item>`).join("")}</list>`);
        break;
      case "table": {
        const head = b.rows.filter((r) => r.header);
        const body = b.rows.filter((r) => !r.header);
        const row = (r: (typeof b.rows)[number], cell: string) => `<tr>${r.cells.map((c) => `<${cell}>${jatsInline(c)}</${cell}>`).join("")}</tr>`;
        out.push(
          `<table-wrap id="t${out.length}">${b.caption?.length ? `<caption><p>${jatsInline(b.caption)}</p></caption>` : ""}<table>${head.length ? `<thead>${head.map((r) => row(r, "th")).join("")}</thead>` : ""}<tbody>${body.map((r) => row(r, "td")).join("")}</tbody></table></table-wrap>`
        );
        break;
      }
      case "quote":
        out.push(`<disp-quote><p>${jatsInline(b.runs)}</p></disp-quote>`);
        break;
      case "code":
        out.push(`<preformat>${escapeXml(b.text)}</preformat>`);
        break;
      case "image":
        if (b.caption?.length || b.alt) out.push(`<fig><caption><p>${b.caption?.length ? jatsInline(b.caption) : escapeXml(b.alt)}</p></caption></fig>`);
        break;
    }
  }
  while (open-- > 0) out.push("</sec>");
  return {
    body: out.join("\n    "),
    back: refs.length ? `<ref-list><title>References</title>\n      ${refs.join("\n      ")}\n    </ref-list>` : "",
  };
}

function buildFallbackJats(meta: any, bodyHtml?: string | null): string {
  const b = brandOf(meta);
  const authors = safeParseAuthors(meta.authors).filter((a: any) => a?.name);
  const affiliations: string[] = Array.from(new Set(authors.map((a: any) => a.affiliation).filter(Boolean)));
  const authorXml = authors
    .map((a: any, i: number) => {
      const parts = String(a.name).trim().split(/\s+/);
      const surname = parts.length > 1 ? parts.pop()! : parts[0];
      const given = parts.length ? parts.join(" ") : "";
      const orcid = a.orcid ? String(a.orcid).replace(/^https?:\/\/orcid\.org\//i, "") : "";
      return `
      <contrib contrib-type="author"${i === 0 ? ' corresp="yes"' : ""}>
        ${orcid ? `<contrib-id contrib-id-type="orcid">https://orcid.org/${escapeXml(orcid)}</contrib-id>` : ""}
        <name><surname>${escapeXml(surname)}</surname>${given ? `<given-names>${escapeXml(given)}</given-names>` : ""}</name>
        ${a.affiliation ? `<xref ref-type="aff" rid="aff${affiliations.indexOf(a.affiliation) + 1}"/>` : ""}
      </contrib>`;
    })
    .join("");
  const affXml = affiliations.map((aff, i) => `<aff id="aff${i + 1}">${escapeXml(aff)}</aff>`).join("\n      ");
  const keywords = String(meta.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean);
  const { body, back } = bodyHtml
    ? buildJatsBodyAndBack(bodyHtml, [meta.title, meta.abstract])
    : { body: `<p>${escapeXml(meta.abstract)}</p>`, back: "" };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.3 20210610//EN" "JATS-archivearticle1.dtd">
<article article-type="research-article" dtd-version="1.3" xml:lang="${ARTICLE_LANGUAGE}"
         xmlns:xlink="http://www.w3.org/1999/xlink">
  <front>
    <journal-meta>
      ${b.issn ? `<journal-id journal-id-type="issn">${escapeXml(b.issn)}</journal-id>` : `<journal-id journal-id-type="publisher-id">${escapeXml(meta.journalName)}</journal-id>`}
      <journal-title-group>
        <journal-title>${escapeXml(meta.journalName)}</journal-title>
        ${b.whitelabel ? (b.abbreviation ? `<abbrev-journal-title>${escapeXml(b.abbreviation)}</abbrev-journal-title>` : "") : "<abbrev-journal-title>EPIP Int. J. Multidiscip. Res.</abbrev-journal-title>"}
      </journal-title-group>
      ${b.eissn ? `${b.issn ? `<issn pub-type="ppub">${escapeXml(b.issn)}</issn>` : ""}<issn pub-type="epub">${escapeXml(b.eissn)}</issn>` : b.issn ? `<issn pub-type="epub">${escapeXml(b.issn)}</issn>` : ""}
      <publisher><publisher-name>${escapeXml(b.publisher)}</publisher-name></publisher>
    </journal-meta>
    <article-meta>
      ${meta.doi ? `<article-id pub-id-type="doi">${escapeXml(meta.doi)}</article-id>` : ""}
      <article-categories><subj-group subj-group-type="heading"><subject>${escapeXml(meta.discipline || "Multidisciplinary")}</subject></subj-group></article-categories>
      <title-group><article-title>${escapeXml(meta.title)}</article-title></title-group>
      <contrib-group>${authorXml}
      </contrib-group>
      ${affXml}
      <pub-date publication-format="electronic" date-type="pub"><year>${escapeXml(String(meta.year))}</year></pub-date>
      <volume>${escapeXml(String(meta.volume))}</volume>
      <issue>${escapeXml(String(meta.issue))}</issue>
      <permissions>
        <copyright-statement>© ${escapeXml(String(meta.year))} the authors</copyright-statement>
        <copyright-year>${escapeXml(String(meta.year))}</copyright-year>
        <license license-type="open-access" xlink:href="https://creativecommons.org/licenses/by/4.0/">
          <license-p>This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International License (CC BY 4.0).</license-p>
        </license>
      </permissions>
      <abstract><p>${escapeXml(meta.abstract)}</p></abstract>
      ${keywords.length ? `<kwd-group kwd-group-type="author">\n${keywords.map((k) => `        <kwd>${escapeXml(k)}</kwd>`).join("\n")}\n      </kwd-group>` : ""}
    </article-meta>
  </front>
  <body>
    ${body}
  </body>${back ? `
  <back>
    ${back}
  </back>` : ""}
</article>
`;
}

// Same premium purple/gold palette as src/lib/certificate-pdf.ts, so every
// PDFKit-rendered document on the platform (certificates and galleys alike)
// reads as one consistent brand identity.
const BRAND_PURPLE = "#4c1d95";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#241b3a";

/**
 * Bump this whenever the visual template (branding, typography, layout)
 * of the rendered galleys changes — scripts/backfill-galleys.ts compares
 * it against each article's stored `galleyTemplateVersion` and
 * automatically re-renders (once, idempotently) any article whose
 * galleys predate the bump, so a template change doesn't require a
 * manual --force run to actually reach already-published articles.
 */
export const GALLEY_TEMPLATE_VERSION = 5;

/**
 * The version the platform's own (non-tenant) galleys must reach. Versions
 * 2 and 4 of GALLEY_TEMPLATE_VERSION only changed whitelabel tenants'
 * galleys (their own publisher, ISSN, e-ISSN, colours, logo and the
 * "Powered by" credit), so platform articles aren't re-rendered for those.
 * 3 is the footer fix that applies to every PDF galley: the running footer
 * no longer spills onto a blank extra page. It is set above any version a
 * platform article could have stored before the fix (at most 2).
 * 5 is the structured typesetting that applies to every galley: headings,
 * lists, tables, figures and references set properly in the PDF, Unicode
 * fonts, a real JATS body and reference list, and an EPUB front matter.
 */
export const PLATFORM_GALLEY_TEMPLATE_VERSION = 5;

/** Strips tags/entities down to readable body text for the PDF body flow. */
export function htmlToPlainText(html: string, stripLeadingParagraphs: (string | undefined)[] = []): string {
  let text = html
    // <head> (title/meta/style) has no visible content — must be dropped
    // entirely, not just <header>, or its <title> text leaks into the body
    // right before the visible <h1>, producing a concatenated double title.
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Drop leading paragraphs that just repeat content already rendered
  // above (title, abstract) — the fallback HTML (the actual production
  // path when Pandoc isn't installed) is nothing but title + abstract, so
  // without this the body section is a verbatim duplicate of the header.
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const stripSet = new Set(stripLeadingParagraphs.filter(Boolean).map((s) => normalize(s as string)));
  if (stripSet.size) {
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    while (paragraphs.length && stripSet.has(normalize(paragraphs[0]))) {
      paragraphs.shift();
    }
    text = paragraphs.join("\n\n");
  }
  return text;
}

/**
 * Renders a real, branded PDF galley entirely in-process with PDFKit (pure
 * JS, no native binaries) — this is the path that actually runs on Vercel's
 * serverless runtime, where WeasyPrint isn't installed.
 */
export function renderPdfKitGalley(meta: any, htmlContent: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const licenseNotice = buildLicenseNotice(meta);
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 64, bottom: 62, left: 60, right: 60 },
        bufferPages: true,
        // Tagged PDF (structure tree, language, title shown in the window
        // bar) so screen readers can navigate headings, lists, tables and
        // figures — see pdfTag in src/lib/galley-pdf.ts.
        tagged: true,
        lang: ARTICLE_LANGUAGE,
        displayTitle: true,
        pdfVersion: "1.7",
        info: {
          Title: meta.title || "Untitled",
          Author: authorNames(meta),
          Subject: licenseNotice,
          Keywords: [meta.keywords, "CC-BY-4.0", meta.doi ? `doi:${meta.doi}` : ""].filter(Boolean).join(", "),
          Creator: brandOf(meta).publisher,
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const fonts = registerGalleyFonts(doc);
      const t = (s: string) => printable(s, fonts);
      const b = brandOf(meta);
      const PRIMARY = b.primary;
      const ACCENT = b.accent;
      const left = doc.page.margins.left;
      const width = doc.page.width - left - doc.page.margins.right;
      const root = pdfStructureRoot(doc);

      // Masthead — the publishing tenant's logo sits top-right when set.
      const logoW = meta.logoPng ? 100 : 0;
      if (meta.logoPng) {
        try {
          pdfTag(doc, root, "Figure", () => {
            doc.image(meta.logoPng, doc.page.width - doc.page.margins.right - 90, doc.page.margins.top - 30, { fit: [90, 40], align: "right" });
          }, { alt: `${b.publisher} logo` });
        } catch {
          /* unreadable logo — masthead text still identifies the publisher */
        }
      }
      pdfTag(doc, root, "P", () => {
        doc.fillColor(ACCENT).font(fonts.sansBold).fontSize(7.5).text(t(b.publisher.toUpperCase()), left, doc.page.margins.top, { width: width - logoW, characterSpacing: 0.8 });
      });
      doc.moveDown(0.25);
      pdfTag(doc, root, "P", () => {
        doc.fillColor(PRIMARY).font(fonts.sansBold).fontSize(12).text(t(meta.journalName || ""), { width: width - logoW });
      });
      const issueLine = [
        issnText(b),
        `Vol. ${meta.volume}, No. ${meta.issue} (${meta.year})`,
        meta.doi ? `DOI: ${meta.doi}` : "",
      ].filter(Boolean).join("  ·  ");
      pdfTag(doc, root, "P", () => {
        doc.fillColor("#5f5873").font(fonts.serif).fontSize(8.5).text(t(issueLine), { width: width - logoW, link: meta.doi ? `https://doi.org/${meta.doi}` : undefined });
      });
      doc.moveDown(0.35);
      pdfArtifact(doc, true, () => {
        doc.save().moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1.4).strokeColor(PRIMARY).stroke().restore();
        doc.save().moveTo(left, doc.y + 2.5).lineTo(left + width, doc.y + 2.5).lineWidth(0.5).strokeColor(ACCENT).stroke().restore();
      });
      doc.y += 16;

      // Article type + title
      pdfTag(doc, root, "P", () => {
        doc.fillColor(ACCENT).font(fonts.sansBold).fontSize(8).text(t((meta.discipline ? `RESEARCH ARTICLE  ·  ${String(meta.discipline).toUpperCase()}` : "RESEARCH ARTICLE")), left, doc.y, { width, characterSpacing: 0.6 });
      });
      doc.moveDown(0.4);
      pdfTag(doc, root, "H1", () => {
        doc.fillColor(PRIMARY).font(fonts.sansBold).fontSize(18).text(t(meta.title || "Untitled"), left, doc.y, { width, lineGap: 2 });
      });
      doc.moveDown(0.6);

      // Authors with numbered affiliations (one number per distinct affiliation).
      const authors = safeParseAuthors(meta.authors).filter((a: any) => a?.name);
      const affiliations: string[] = [];
      for (const a of authors) if (a.affiliation && !affiliations.includes(a.affiliation)) affiliations.push(a.affiliation);
      const numbered = affiliations.length > 1;
      if (authors.length) {
        const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
        const supNum = (n: number) => (fonts.unicode ? String(n).split("").map((d) => SUP[Number(d)]).join("") : `[${n}]`);
        const line = authors
          .map((a: any) => t(a.name) + (numbered && a.affiliation ? supNum(affiliations.indexOf(a.affiliation) + 1) : ""))
          .join(", ");
        pdfTag(doc, root, "P", () => {
          doc.fillColor("#1f1a2e").font(fonts.serifBold).fontSize(11).text(line, left, doc.y, { width, lineGap: 1 });
        });
        if (affiliations.length) {
          doc.moveDown(0.3);
          affiliations.forEach((aff, i) => {
            pdfTag(doc, root, "P", () => {
              doc.font(fonts.serifItalic).fontSize(8.5).fillColor("#5f5873");
              doc.text(t(numbered ? `${supNum(i + 1)} ${aff}` : aff), left, doc.y, { width, lineGap: 0.5 });
            });
          });
        }
        doc.moveDown(0.9);
      }

      // Abstract box
      if (meta.abstract) {
        const pad = 10;
        doc.font(fonts.serif).fontSize(9.8);
        const absH = doc.heightOfString(t(meta.abstract), { width: width - pad * 2 - 4, lineGap: 1.8, align: "justify" });
        const kwText = meta.keywords ? `Keywords: ${meta.keywords}` : "";
        doc.font(fonts.serifItalic).fontSize(8.8);
        const kwH = kwText ? doc.heightOfString(t(kwText), { width: width - pad * 2 - 4 }) + 6 : 0;
        const boxH = pad + 12 + absH + kwH + pad;
        if (doc.y + boxH > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y0 = doc.y;
        pdfArtifact(doc, true, () => {
          doc.save().fillColor(PRIMARY).fillOpacity(0.06).rect(left, y0, width, boxH).fill().restore();
          doc.save().rect(left, y0, 3, boxH).fill(ACCENT).restore();
        });
        pdfTag(doc, root, "H2", () => {
          doc.fillColor(PRIMARY).font(fonts.sansBold).fontSize(8.5).text("ABSTRACT", left + pad + 4, y0 + pad, { width: width - pad * 2 - 4, characterSpacing: 0.8 });
        });
        doc.y = y0 + pad + 12;
        pdfTag(doc, root, "P", () => {
          doc.fillColor("#1f1a2e").font(fonts.serif).fontSize(9.8).text(t(meta.abstract), left + pad + 4, doc.y, { width: width - pad * 2 - 4, lineGap: 1.8, align: "justify" });
        });
        if (kwText) {
          doc.y += 6;
          pdfTag(doc, root, "P", () => {
            doc.font(fonts.serifBold).fontSize(8.8).fillColor(PRIMARY).text("Keywords: ", left + pad + 4, doc.y, { continued: true, width: width - pad * 2 - 4 });
            doc.font(fonts.serifItalic).fillColor("#3d3550").text(t(meta.keywords));
          });
        }
        doc.y = y0 + boxH + 10;
      } else if (meta.keywords) {
        pdfTag(doc, root, "P", () => {
          doc.font(fonts.serifItalic).fontSize(8.8).fillColor("#3d3550").text(t(`Keywords: ${meta.keywords}`), left, doc.y, { width });
        });
        doc.moveDown(0.8);
      }

      // How to cite + licence, set small under the abstract.
      const cite = `${citationAuthors(authors)} (${meta.year}). ${meta.title}. ${meta.journalName}, ${meta.volume}(${meta.issue}).${meta.doi ? ` https://doi.org/${meta.doi}` : ""}`;
      pdfTag(doc, root, "P", () => {
        doc.font(fonts.serifBold).fontSize(7.8).fillColor(PRIMARY).text("Cite as: ", left, doc.y, { continued: true, width });
        doc.font(fonts.serif).fillColor("#5f5873").text(t(cite), { lineGap: 0.6 });
      });
      pdfTag(doc, root, "P", () => {
        doc.font(fonts.serifBold).fontSize(7.8).fillColor(PRIMARY).text("Licence: ", left, doc.y + 1, { continued: true, width });
        doc.font(fonts.serif).fillColor("#5f5873").text(
          t(`© ${meta.year} the authors. Open access under the Creative Commons Attribution 4.0 International licence (CC BY 4.0), which permits use, distribution and reproduction in any medium, provided the original work is properly cited.`),
          { lineGap: 0.6, link: "https://creativecommons.org/licenses/by/4.0/" }
        );
      });
      doc.y += 8;
      pdfArtifact(doc, true, () => {
        doc.save().moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor("#d8d3e2").stroke().restore();
      });
      doc.y += 12;

      // Body — headings, paragraphs, lists, tables, figures and references,
      // each set as a print journal sets it (src/lib/galley-pdf.ts).
      renderBody(doc, htmlContent, {
        fonts,
        primary: PRIMARY,
        accent: ACCENT,
        ink: "#1f1a2e",
        muted: "#5f5873",
        skipLeading: [meta.title, meta.abstract],
        tagRoot: root,
      });
      root.end();

      // Running header (from page 2) and footer on every page. Writing
      // outside the margins must not make PDFKit start a new page, so the
      // margins are lifted while these are drawn.
      const range = doc.bufferedPageRange();
      const total = range.count;
      const firstAuthor = authors[0]?.name ? String(authors[0].name).trim().split(/\s+/).pop() : "";
      const runningAuthors = authors.length > 2 ? `${firstAuthor} et al.` : authors.map((a: any) => String(a.name).trim().split(/\s+/).pop()).join(" & ");
      const shortTitle = (meta.title || "").length > 70 ? `${String(meta.title).slice(0, 67).replace(/\s+\S*$/, "")}…` : meta.title || "";
      for (let i = range.start; i < range.start + total; i++) {
        doc.switchToPage(i);
        const { top, bottom } = doc.page.margins;
        doc.page.margins.top = 0;
        doc.page.margins.bottom = 0;
        const pageNo = i - range.start + 1;
        // Running headers and footers are page furniture: Artifacts, not content.
        (doc as any).markContent("Artifact", { type: "Pagination" });
        if (pageNo > 1) {
          doc.font(fonts.serifItalic).fontSize(7.5).fillColor("#7a7390");
          doc.text(t(runningAuthors), left, top - 26, { width: width / 2 - 6, lineBreak: false, ellipsis: true });
          doc.text(t(shortTitle), left + width / 2 + 6, top - 26, { width: width / 2 - 6, align: "right", lineBreak: false, ellipsis: true });
          doc.save().moveTo(left, top - 14).lineTo(left + width, top - 14).lineWidth(0.4).strokeColor("#d8d3e2").stroke().restore();
        }
        const fy = doc.page.height - bottom + 16;
        doc.save().moveTo(left, fy - 6).lineTo(left + width, fy - 6).lineWidth(0.4).strokeColor("#d8d3e2").stroke().restore();
        doc.font(fonts.serif).fontSize(7.5).fillColor(PRIMARY).text(t(footerLine(meta)), left, fy, { width: width - 80, lineBreak: false, ellipsis: true });
        doc.font(fonts.sansBold).fontSize(7.5).fillColor(PRIMARY).text(`${pageNo} / ${total}`, left + width - 80, fy, { width: 80, align: "right", lineBreak: false });
        if (b.credit) {
          // Fixed platform credit under the running footer of every page.
          doc.font(fonts.serif).fontSize(6.5).fillColor("#888888").text(t(b.credit), left, fy + 12, { width, align: "center", lineBreak: false });
        }
        (doc as any).endMarkedContent();
        doc.page.margins.top = top;
        doc.page.margins.bottom = bottom;
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/** APA-style author list for the "Cite as" line: "Tan, M. L., Adebayo, O., & Reyes, A." */
function citationAuthors(authors: any[]): string {
  const fmt = (name: string) => {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || "";
    const last = parts.pop()!;
    return `${last}, ${parts.map((p) => `${p[0].toUpperCase()}.`).join(" ")}`;
  };
  const names = authors.map((a) => fmt(a.name)).filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, … ${names[names.length - 1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

/** Absolute last resort — a minimal but still valid, openable PDF. */
export function renderMinimalErrorPdf(meta: { title: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 72, bottom: 72, left: 72, right: 72 } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.font("Helvetica-Bold").fontSize(14).text(meta.title || "Untitled");
      doc.moveDown();
      doc.font("Helvetica").fontSize(10).text(
        "The PDF galley could not be fully rendered. Please contact the editorial office to regenerate this file."
      );
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function safeParseAuthors(authorsJson: string): any[] {
  try {
    return JSON.parse(authorsJson || "[]");
  } catch {
    return [];
  }
}

function authorNames(meta: any): string {
  return safeParseAuthors(meta.authors).map((a: any) => a.name).filter(Boolean).join(", ");
}

/**
 * Baseline license + attribution notice embedded in every generated
 * galley's own file metadata (PDF Subject/Keywords, EPUB dc:rights) —
 * independent of, and present even without, the per-download stamp added
 * at request time by src/lib/watermark.ts. Ensures a copy obtained any
 * other way than this platform's own download button still carries real
 * CC BY 4.0 terms and a citation, reducing accidental misattribution.
 */
export function buildLicenseNotice(meta: {
  authors: string;
  title: string;
  year: number;
  journalName: string;
  doi: string;
}): string {
  const cite = `${authorNames(meta)} (${meta.year}). ${meta.title}. ${meta.journalName}.${meta.doi ? ` https://doi.org/${meta.doi}` : ""}`;
  return `Licensed under CC BY 4.0 — attribution required, redistribution and commercial reuse permitted. Cite as: ${cite}`;
}
