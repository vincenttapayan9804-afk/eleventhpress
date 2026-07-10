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
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { putObject } from "@/lib/storage";

const PROJECT_ROOT = process.cwd();
const TEMP_DIR = path.join(PROJECT_ROOT, "storage", "tmp");

const EPIP_CSS = `
@page {
  size: A4;
  margin: 25mm 22mm 25mm 22mm;
  @bottom-center {
    content: "Eleventh Press International Publishing — ISSN 2945-1138";
    font-family: Georgia, serif;
    font-size: 8pt;
    color: #7A1F2B;
  }
  @bottom-right { content: counter(page); font-family: sans-serif; font-size: 8pt; }
}
body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #2a1f1a; }
h1 { font-size: 20pt; color: #7A1F2B; border-bottom: 1px solid #c9a55c; padding-bottom: 0.3em; }
h2 { font-size: 14pt; color: #7A1F2B; margin-top: 1.5em; }
h3 { font-size: 12pt; color: #4a1519; }
.abstract { background: #faf6ef; border-left: 3px solid #c9a55c; padding: 1em 1.5em; margin: 1em 0; font-size: 10pt; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 0.4em; font-size: 10pt; }
th { background: #faf6ef; color: #7A1F2B; }
code { font-family: monospace; font-size: 9pt; background: #f4f0e8; padding: 0.1em 0.3em; }
`;

export interface GalleyResult {
  htmlKey: string;
  pdfKey: string;
  jatsKey: string | null;
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

function escapeXml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
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
  const log: string[] = [];
  const jobId = crypto.randomBytes(6).toString("hex");
  log.push(`[${new Date().toISOString()}] Starting galley generation job ${jobId}`);

  await fs.mkdir(TEMP_DIR, { recursive: true });

  const ext = manuscriptName.split(".").pop()?.toLowerCase() || "md";
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
      htmlContent = await fs.readFile(htmlPath, "utf-8");
      htmlContent = injectBrand(htmlContent, meta);
    } else {
      // Fallback HTML
      htmlContent = `<!DOCTYPE html><html><head><title>${escapeXml(meta.title)}</title></head><body><h1>${escapeXml(meta.title)}</h1><div class="abstract"><p>${escapeXml(meta.abstract)}</p></div></body></html>`;
      log.push("HTML galley built via fallback");
    }
  } catch (e: any) {
    log.push(`HTML error: ${e.message}`);
    htmlContent = `<!DOCTYPE html><html><body><h1>${escapeXml(meta.title)}</h1><p>${escapeXml(meta.abstract)}</p></body></html>`;
  }

  // 2. PDF galley via WeasyPrint
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
      jatsContent = buildFallbackJats(meta);
      log.push("JATS built via fallback");
    }
  } catch (e: any) {
    jatsContent = buildFallbackJats(meta);
    log.push(`JATS error: ${e.message}, using fallback`);
  }

  // Write galleys to storage
  const htmlKey = `published-galleys/${suffix}.html`;
  const pdfKey = `published-galleys/${suffix}.pdf`;
  const jatsKey = `published-galleys/${suffix}.jats.xml`;

  await putObject(htmlKey, Buffer.from(htmlContent, "utf-8"), "text/html; charset=utf-8");
  log.push(`Stored HTML: ${htmlKey} (${htmlContent.length} chars)`);

  if (pdfBuffer) {
    await putObject(pdfKey, pdfBuffer, "application/pdf");
    log.push(`Stored PDF: ${pdfKey} (${pdfBuffer.length} bytes)`);
  } else {
    // Write a placeholder PDF if WeasyPrint failed
    await putObject(pdfKey, Buffer.from("PDF generation failed - placeholder"), "application/pdf");
    log.push(`Stored PDF placeholder: ${pdfKey}`);
  }

  if (jatsContent) {
    await putObject(jatsKey, Buffer.from(jatsContent, "utf-8"), "application/xml");
    log.push(`Stored JATS: ${jatsKey} (${jatsContent.length} chars)`);
  }

  // Cleanup temp files
  try {
    const temps = await fs.readdir(TEMP_DIR);
    for (const f of temps) {
      if (f.startsWith(jobId)) await fs.unlink(path.join(TEMP_DIR, f)).catch(() => {});
    }
  } catch {}

  log.push(`[${new Date().toISOString()}] Job ${jobId} complete`);
  return { htmlKey, pdfKey, jatsKey, log };
}

function injectBrand(html: string, meta: any): string {
  const header = `
<header style="border-bottom: 2px solid #7A1F2B; padding: 1em 0; margin-bottom: 2em;">
  <div style="font-family: sans-serif; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; color: #c9a55c; font-weight: 600;">Eleventh Press International Publishing</div>
  <div style="font-family: Georgia, serif; font-size: 1.1rem; color: #7A1F2B; font-weight: 600; margin-top: 0.2em;">${escapeXml(meta.journalName)}</div>
  <div style="font-size: 0.75rem; color: #666; margin-top: 0.2em;">ISSN ${escapeXml(meta.issn)} · Vol. ${meta.volume}, Iss. ${meta.issue} (${meta.year}) · DOI: <a href="https://doi.org/${escapeXml(meta.doi)}">${escapeXml(meta.doi)}</a></div>
</header>`;
  return html.replace(/<body>/, `<body>${header}`);
}

function buildFallbackJats(meta: any): string {
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
<article article-type="research-article" dtd-version="1.3" xml:lang="en"
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
  <body><p>${escapeXml(meta.abstract)}</p></body>
  <back>
    <ref-list>
      <ref id="ref1"><citation><journal-title>Eleventh Press International Publishing</journal-title></citation></ref>
    </ref-list>
  </back>
</article>`;
}
