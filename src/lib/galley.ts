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
import { ARTICLE_LANGUAGE } from "@/lib/site";

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
};

// Vercel serverless functions ship a read-only deployment bundle — only
// os.tmpdir() (/tmp) is writable at runtime. A project-relative path here
// throws EROFS on every publish, which the caller swallows into a silent
// placeholder-galley fallback (dead download links) rather than a visible
// error.
const TEMP_DIR = path.join(os.tmpdir(), "epip-galley");

const EPIP_CSS = `
@page {
  size: A4;
  margin: 25mm 22mm 25mm 22mm;
  @bottom-center {
    content: "Eleventh Press International Publishing — ISSN 2945-1138";
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
      pageTexts.push(content.items.map((item: any) => item.str || "").join(" "));
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
      return text ? plainTextToHtml(text) : null;
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
  }
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
  await fs.writeFile(cssPath, EPIP_CSS);

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

  const suffix = meta.doi?.split(".").pop() || meta.id.slice(-6);
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
  const htmlKey = `published-galleys/${suffix}.html`;
  const pdfKey = `published-galleys/${suffix}.pdf`;
  const jatsKey = `published-galleys/${suffix}.jats.xml`;
  const epubKey = `published-galleys/${suffix}.epub`;

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
    const chapterHtml = pdfBodySource || `<p>${escapeXml(meta.abstract)}</p>`;
    const epubBuffer = buildEpub(
      { id: meta.id, title: meta.title, subtitle: null, authors: epubAuthorNames, rights: buildLicenseNotice(meta) },
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

function injectBrand(html: string, meta: any): string {
  const header = `
<header style="border-bottom: 2px solid #4c1d95; padding: 1em 0; margin-bottom: 2em;">
  <div style="font-family: sans-serif; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; color: #c9a55c; font-weight: 600;">Eleventh Press International Publishing</div>
  <div style="font-family: Georgia, serif; font-size: 1.1rem; color: #4c1d95; font-weight: 600; margin-top: 0.2em;">${escapeXml(meta.journalName)}</div>
  <div style="font-size: 0.75rem; color: #666; margin-top: 0.2em;">ISSN ${escapeXml(meta.issn)} · Vol. ${meta.volume}, Iss. ${meta.issue} (${meta.year}) · DOI: <a href="https://doi.org/${escapeXml(meta.doi)}">${escapeXml(meta.doi)}</a></div>
</header>`;
  return html.replace(/<body>/, `<body>${header}`);
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
  const authors = safeParseAuthors(meta.authors);
  const authorLine = authors.map((a: any) => escapeXml(a.name)).filter(Boolean).join(", ");
  const affiliations = Array.from(new Set(authors.map((a: any) => a.affiliation).filter(Boolean)));
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeXml(meta.title)}</title>
<style>${EPIP_CSS}</style>
</head>
<body>
<h1>${escapeXml(meta.title)}</h1>
${authorLine ? `<p><strong>${authorLine}</strong></p>` : ""}
${affiliations.length ? `<p style="font-size: 0.85em; color: #555;">${affiliations.map(escapeXml).join(" · ")}</p>` : ""}
<div class="abstract"><p>${escapeXml(meta.abstract)}</p></div>
${meta.keywords ? `<p><em>Keywords: ${escapeXml(meta.keywords)}</em></p>` : ""}
${bodyHtml ? `<div class="article-body">${bodyHtml}</div>` : ""}
</body>
</html>`;
  return injectBrand(doc, meta);
}

function buildFallbackJats(meta: any, bodyHtml?: string | null): string {
  const authors = JSON.parse(meta.authors || "[]");
  const authorXml = authors.map((a: any, i: number) => `
    <contrib contrib-type="author" corresp="${i === 0 ? "yes" : "no"}">
      <name>
        <surname>${a.name.split(" ").slice(-1).join(" ")}</surname>
        <given-names>${a.name.split(" ").slice(0, -1).join(" ")}</given-names>
      </name>
      <aff>${a.affiliation || ""}</aff>
      ${a.orcid ? `<contrib-id contrib-id-type="orcid">${a.orcid}</contrib-id>` : ""}
    </contrib>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.3 20210610//EN" "JATS-archivearticle1.dtd">
<article article-type="research-article" dtd-version="1.3" xml:lang="${ARTICLE_LANGUAGE}"
         xmlns:xlink="http://www.w3.org/1999/xlink">
  <front>
    <journal-meta>
      <journal-id journal-id-type="issn">${escapeXml(meta.issn)}</journal-id>
      <journal-title-group>
        <journal-title>${escapeXml(meta.journalName)}</journal-title>
        <abbrev-journal-title>EPIP Int. J. Multidiscip. Res.</abbrev-journal-title>
      </journal-title-group>
      <issn pub-type="epub">${escapeXml(meta.issn)}</issn>
      <publisher><publisher-name>Eleventh Press International Publishing</publisher-name></publisher>
    </journal-meta>
    <article-meta>
      <article-id pub-id-type="doi">${escapeXml(meta.doi)}</article-id>
      <article-categories><subj-group><subject>${escapeXml(meta.discipline || "Multidisciplinary")}</subject></subj-group></article-categories>
      <title-group><article-title>${escapeXml(meta.title)}</article-title></title-group>
      <contrib-group>${authorXml}
      </contrib-group>
      <pub-date pub-type="epub"><year>${meta.year}</year></pub-date>
      <volume>${meta.volume}</volume>
      <issue>${meta.issue}</issue>
      <permissions>
        <license license-type="open-access" xlink:href="https://creativecommons.org/licenses/by/4.0/">
          <license-p>Open-access article under CC BY 4.0.</license-p>
        </license>
      </permissions>
      <abstract>${escapeXml(meta.abstract)}</abstract>
      <kwd-group>
${(meta.keywords || "").split(",").map((k: string) => `        <kwd>${escapeXml(k.trim())}</kwd>`).join("\n")}
      </kwd-group>
    </article-meta>
  </front>
  <body>${
    bodyHtml
      ? htmlToPlainText(bodyHtml, [meta.title, meta.abstract])
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => `<p>${escapeXml(p)}</p>`)
          .join("\n    ")
      : `<p>${escapeXml(meta.abstract)}</p>`
  }</body>
  <back>
    <ref-list>
      <ref id="ref1"><citation><journal-title>Eleventh Press International Publishing</journal-title></citation></ref>
    </ref-list>
  </back>
</article>`;
}

// Same premium purple/gold palette as src/lib/certificate-pdf.ts, so every
// PDFKit-rendered document on the platform (certificates and galleys alike)
// reads as one consistent brand identity.
const BRAND_PURPLE = "#4c1d95";
const BRAND_GOLD = "#c9a55c";
const BRAND_INK = "#241b3a";

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
function renderPdfKitGalley(meta: any, htmlContent: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const licenseNotice = buildLicenseNotice(meta);
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 64, bottom: 56, left: 56, right: 56 },
        bufferPages: true,
        info: {
          Title: meta.title || "Untitled",
          Author: authorNames(meta),
          Subject: licenseNotice,
          Keywords: `CC-BY-4.0${meta.doi ? `, doi:${meta.doi}` : ""}`,
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Masthead
      doc.fillColor(BRAND_GOLD).font("Helvetica-Bold").fontSize(8)
        .text("ELEVENTH PRESS INTERNATIONAL PUBLISHING");
      doc.moveDown(0.2);
      doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(12).text(meta.journalName || "");
      doc.fillColor("#666666").font("Helvetica").fontSize(8).text(
        `ISSN ${meta.issn || "—"} · Vol. ${meta.volume}, Iss. ${meta.issue} (${meta.year}) · DOI: ${meta.doi || "—"}`
      );
      doc.moveDown(0.3);
      doc.strokeColor(BRAND_PURPLE).lineWidth(1.2)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(1);

      // Title
      doc.fillColor(BRAND_PURPLE).font("Helvetica-Bold").fontSize(18).text(meta.title || "Untitled");
      doc.moveDown(0.5);

      // Authors + affiliations
      const authors = safeParseAuthors(meta.authors);
      if (authors.length) {
        doc.fillColor(BRAND_INK).font("Helvetica-Bold").fontSize(10)
          .text(authors.map((a: any) => a.name).filter(Boolean).join(", "));
        const affiliations = Array.from(new Set(authors.map((a: any) => a.affiliation).filter(Boolean)));
        if (affiliations.length) {
          doc.font("Helvetica").fontSize(8.5).fillColor("#555555").text(affiliations.join(" · "));
        }
        doc.moveDown(0.8);
      }

      // Abstract
      if (meta.abstract) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND_PURPLE).text("ABSTRACT");
        doc.moveDown(0.15);
        doc.font("Helvetica").fontSize(9.5).fillColor(BRAND_INK).text(meta.abstract, { align: "justify" });
        doc.moveDown(0.6);
      }

      if (meta.keywords) {
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#555555").text(`Keywords: ${meta.keywords}`);
        doc.moveDown(1);
      }

      // Body — one .text() call per paragraph (not the whole body as a
      // single blob) so each paragraph gets its own justified, first-line-
      // indented block, matching formal print-journal typesetting.
      const bodyText = htmlToPlainText(htmlContent, [meta.title, meta.abstract]);
      if (bodyText) {
        const paragraphs = bodyText.split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
        doc.font("Helvetica").fontSize(10).fillColor(BRAND_INK);
        for (const paragraph of paragraphs) {
          doc.text(paragraph, { align: "justify", indent: 18 });
          doc.moveDown(0.5);
        }
      }

      // Footer on every page
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(7.5).fillColor(BRAND_PURPLE).text(
          `Eleventh Press International Publishing — ISSN ${meta.issn || "—"} · Page ${i - range.start + 1}`,
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom + 18,
          { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
        );
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
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
