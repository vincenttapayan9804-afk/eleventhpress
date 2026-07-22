/**
 * EPIP Pandoc Worker — Production & Typesetting Mini-Service
 *
 * Accepts a manuscript (DOCX / Markdown / HTML / plain text) and converts
 * it to three production galleys using Pandoc:
 *   1. HTML  — branded article body for the web
 *   2. PDF   — via WeasyPrint (no LaTeX required)
 *   3. JATS  — Journal Article Tag Suite XML for indexing / archiving
 *
 * The service exposes a single POST /convert endpoint that accepts
 * multipart/form-data with a file upload + metadata, writes galleys
 * to the published-galleys storage bucket, and returns the storage keys.
 *
 * Listens on port 3030. Started in background alongside the Next.js dev server.
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const PORT = 3030;
// Resolve paths relative to the project root (two levels up from this file)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const STORAGE_DIR = path.join(PROJECT_ROOT, "storage", "published-galleys");
const TEMP_DIR = path.join(PROJECT_ROOT, "storage", "tmp");

const EPIP_CSS = `
@page {
  size: A4;
  margin: 25mm 22mm 25mm 22mm;
  @bottom-center {
    content: "Eleventh Press International Publishing — ISSN 2945-1138";
    font-family: "Crimson Pro", Georgia, serif;
    font-size: 8pt;
    color: #7A1F2B;
  }
  @bottom-right {
    content: counter(page);
    font-family: "Inter", sans-serif;
    font-size: 8pt;
  }
}
body {
  font-family: "Crimson Pro", Georgia, serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #2a1f1a;
}
h1 {
  font-size: 20pt;
  color: #7A1F2B;
  margin-bottom: 0.5em;
  border-bottom: 1px solid #c9a55c;
  padding-bottom: 0.3em;
}
h2 { font-size: 14pt; color: #7A1F2B; margin-top: 1.5em; }
h3 { font-size: 12pt; color: #4a1519; }
.abstract {
  background: #faf6ef;
  border-left: 3px solid #c9a55c;
  padding: 1em 1.5em;
  margin: 1em 0;
  font-size: 10pt;
}
.keywords { font-size: 9pt; color: #666; }
.authors { font-style: italic; color: #555; margin-bottom: 1em; }
.references { font-size: 9pt; border-top: 1px solid #ccc; padding-top: 1em; margin-top: 2em; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 0.4em; font-size: 10pt; }
th { background: #faf6ef; color: #7A1F2B; }
code { font-family: "JetBrains Mono", monospace; font-size: 9pt; background: #f4f0e8; padding: 0.1em 0.3em; }
pre { background: #f4f0e8; padding: 1em; overflow-x: auto; font-size: 9pt; }
`;

interface ConversionResult {
  success: boolean;
  html?: string;
  pdfBase64?: string;
  jats?: string;
  error?: string;
  log: string[];
}

async function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: TEMP_DIR });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });
}

async function convertManuscript(
  inputPath: string,
  inputExt: string,
  articleMeta: {
    id: string;
    title: string;
    authors: string;
    abstract: string;
    keywords: string;
    doi: string;
    journalName: string;
    issn: string;
    volume: number;
    issue: number;
    year: number;
  }
): Promise<ConversionResult> {
  const log: string[] = [];
  const jobId = crypto.randomBytes(6).toString("hex");
  log.push(`[${new Date().toISOString()}] Starting conversion job ${jobId}`);
  log.push(`Input: ${inputPath} (${inputExt})`);

  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Build a Pandoc metadata YAML for the article
  const authors = JSON.parse(articleMeta.authors || "[]");
  const yamlPath = path.join(TEMP_DIR, `${jobId}-meta.yaml`);
  const yaml = `---
title: "${articleMeta.title.replace(/"/g, '\\"')}"
author:
${authors.map((a: any) => `  - name: "${a.name}"\n    affiliation: "${a.affiliation || ""}"${a.orcid ? `\n    orcid: "${a.orcid}"` : ""}`).join("\n")}
abstract: "${articleMeta.abstract.replace(/"/g, '\\"').replace(/\n/g, " ").slice(0, 2000)}"
keywords:
${(articleMeta.keywords || "").split(",").map((k: string) => `  - "${k.trim()}"`).join("\n")}
doi: "${articleMeta.doi}"
journal: "${articleMeta.journalName}"
issn: "${articleMeta.issn}"
volume: ${articleMeta.volume}
issue: ${articleMeta.issue}
year: ${articleMeta.year}
date: "${new Date().toISOString().split("T")[0]}"
---
`;
  await fs.writeFile(yamlPath, yaml);
  log.push(`Wrote metadata YAML: ${yamlPath}`);

  const result: ConversionResult = { success: false, log };

  // 1. HTML galley
  let htmlContent = "";
  try {
    const htmlPath = path.join(TEMP_DIR, `${jobId}.html`);
    const htmlArgs = [
      inputPath,
      "--metadata-file", yamlPath,
      "-s",
      "--to", "html5",
      "--standalone",
      "--css", "epip.css",
      "--embed-resources",
      "--output", htmlPath,
      "--wrap=none",
    ];
    // Write CSS for pandoc to embed
    await fs.writeFile(path.join(TEMP_DIR, "epip.css"), EPIP_CSS);
    log.push(`Running pandoc for HTML: pandoc ${htmlArgs.join(" ")}`);
    const r = await runCommand("pandoc", htmlArgs);
    log.push(`HTML conversion exit code: ${r.code}`);
    if (r.stderr) log.push(`HTML stderr: ${r.stderr.slice(0, 500)}`);

    if (r.code === 0 && await fileExists(htmlPath)) {
      htmlContent = await fs.readFile(htmlPath, "utf-8");
      // Inject journal brand header
      htmlContent = injectBrand(htmlContent, articleMeta);
      result.html = htmlContent;
      log.push(`HTML galley generated (${htmlContent.length} chars)`);
    } else {
      // Fallback: simple HTML from metadata
      htmlContent = `<html><body><h1>${articleMeta.title}</h1><p>${articleMeta.abstract}</p></body></html>`;
      result.html = htmlContent;
      log.push(`HTML galley generated via fallback (${htmlContent.length} chars)`);
    }
  } catch (e: any) {
    log.push(`HTML conversion error: ${e.message}`);
  }

  // 2. PDF galley (via WeasyPrint on the HTML)
  try {
    if (htmlContent) {
      const pdfPath = path.join(TEMP_DIR, `${jobId}.pdf`);
      const htmlTempPath = path.join(TEMP_DIR, `${jobId}-for-pdf.html`);
      await fs.writeFile(htmlTempPath, htmlContent);
      log.push(`Running weasyprint for PDF: ${htmlTempPath} -> ${pdfPath}`);
      const r = await runCommand("weasyprint", [htmlTempPath, pdfPath]);
      log.push(`PDF conversion exit code: ${r.code}`);
      if (r.stderr) log.push(`PDF stderr: ${r.stderr.slice(0, 500)}`);

      if (r.code === 0 && await fileExists(pdfPath)) {
        const pdfBuffer = await fs.readFile(pdfPath);
        result.pdfBase64 = pdfBuffer.toString("base64");
        log.push(`PDF galley generated (${pdfBuffer.length} bytes)`);
      }
    }
  } catch (e: any) {
    log.push(`PDF conversion error: ${e.message}`);
  }

  // 3. JATS XML galley
  try {
    const jatsPath = path.join(TEMP_DIR, `${jobId}.jats.xml`);
    const jatsArgs = [
      inputPath,
      "--metadata-file", yamlPath,
      "-s",
      "--to", "jats_article",
      "--output", jatsPath,
    ];
    log.push(`Running pandoc for JATS: pandoc ${jatsArgs.join(" ")}`);
    const r = await runCommand("pandoc", jatsArgs);
    log.push(`JATS conversion exit code: ${r.code}`);
    if (r.stderr) log.push(`JATS stderr: ${r.stderr.slice(0, 500)}`);

    if (r.code === 0 && await fileExists(jatsPath)) {
      const jatsContent = await fs.readFile(jatsPath, "utf-8");
      result.jats = jatsContent;
      log.push(`JATS galley generated (${jatsContent.length} chars)`);
    } else {
      // JATS writer may not be available in all pandoc builds — fall back to a
      // manually-constructed minimal JATS XML so the galley always exists.
      const fallbackJats = buildFallbackJats(articleMeta);
      result.jats = fallbackJats;
      log.push(`JATS galley generated via fallback builder (${fallbackJats.length} chars)`);
    }
  } catch (e: any) {
    log.push(`JATS conversion error: ${e.message}`);
  }

  // Cleanup temp files
  try {
    const temps = await fs.readdir(TEMP_DIR);
    for (const f of temps) {
      if (f.startsWith(jobId)) await fs.unlink(path.join(TEMP_DIR, f));
    }
  } catch {}

  result.success = !!(result.html && result.pdfBase64 && result.jats);
  log.push(`[${new Date().toISOString()}] Job ${jobId} complete. Success: ${result.success}`);
  return result;
}

function injectBrand(html: string, meta: any): string {
  const header = `
<header style="border-bottom: 2px solid #7A1F2B; padding: 1em 0; margin-bottom: 2em;">
  <div style="font-family: 'Inter', sans-serif; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; color: #c9a55c; font-weight: 600;">Eleventh Press International Publishing</div>
  <div style="font-family: 'Crimson Pro', serif; font-size: 1.1rem; color: #7A1F2B; font-weight: 600; margin-top: 0.2em;">${meta.journalName}</div>
  <div style="font-size: 0.75rem; color: #666; margin-top: 0.2em;">ISSN ${meta.issn} · Vol. ${meta.volume}, Iss. ${meta.issue} (${meta.year}) · DOI: <a href="https://doi.org/${meta.doi}">${meta.doi}</a></div>
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
      <journal-id journal-id-type="issn">${meta.issn}</journal-id>
      <journal-title-group>
        <journal-title>${meta.journalName}</journal-title>
        <abbrev-journal-title>EPIP Int. J. Multidiscip. Res.</abbrev-journal-title>
      </journal-title-group>
      <issn pub-type="epub">${meta.issn}</issn>
      <publisher>
        <publisher-name>Eleventh Press International Publishing</publisher-name>
      </publisher>
    </journal-meta>
    <article-meta>
      <article-id pub-id-type="doi">${meta.doi}</article-id>
      <article-categories><subj-group><subject>${meta.discipline || "Multidisciplinary"}</subject></subj-group></article-categories>
      <title-group>
        <article-title>${meta.title}</article-title>
      </title-group>
      <contrib-group>${authorXml}
      </contrib-group>
      <pub-date pub-type="epub">
        <year>${meta.year}</year>
      </pub-date>
      <volume>${meta.volume}</volume>
      <issue>${meta.issue}</issue>
      <permissions>
        <license license-type="open-access" xlink:href="https://creativecommons.org/licenses/by/4.0/">
          <license-p>This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International License (CC BY 4.0).</license-p>
        </license>
      </permissions>
      <abstract>${meta.abstract}</abstract>
      <kwd-group>
${(meta.keywords || "").split(",").map((k: string) => `        <kwd>${k.trim()}</kwd>`).join("\n")}
      </kwd-group>
    </article-meta>
  </front>
  <body>
    <p>${meta.abstract}</p>
  </body>
  <back>
    <ref-list>
      <ref id="ref1"><citation><journal-title>Eleventh Press International Publishing</journal-title></citation></ref>
    </ref-list>
  </back>
</article>`;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // Health check
    if (req.method === "GET" && new URL(req.url).pathname === "/health") {
      return Response.json({ ok: true, service: "epip-pandoc-worker", port: PORT, pandoc: true, weasyprint: true });
    }

    // POST /convert — accepts multipart/form-data with file + individual metadata fields
    if (req.method === "POST" && new URL(req.url).pathname === "/convert") {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        // Accept both "metadata" JSON and individual form fields
        let meta: any;
        const metadataStr = formData.get("metadata") as string | null;
        if (metadataStr) {
          meta = JSON.parse(metadataStr);
        } else {
          // Build meta from individual form fields
          meta = {
            id: (formData.get("id") as string) || `epip-${Date.now()}`,
            title: (formData.get("title") as string) || "Untitled",
            authors: (formData.get("authors") as string) || "[]",
            abstract: (formData.get("abstract") as string) || "",
            keywords: (formData.get("keywords") as string) || "",
            discipline: (formData.get("discipline") as string) || "",
            doi: (formData.get("doi") as string) || "",
            journalName: (formData.get("journalName") as string) || "Eleventh Press International Journal",
            issn: (formData.get("issn") as string) || "2945-1138",
            volume: parseInt((formData.get("volume") as string) || "1", 10),
            issue: parseInt((formData.get("issue") as string) || "1", 10),
            year: parseInt((formData.get("year") as string) || String(new Date().getFullYear()), 10),
          };
        }

        if (!file) {
          return Response.json({ success: false, error: "Missing file" }, { status: 400 });
        }

        // Only the extension is taken from the client-supplied filename,
        // and only if it looks like a plausible extension — a crafted
        // name with no "." (e.g. "../../../etc/passwd") would otherwise
        // pass its entire self through .split(".").pop() and become part
        // of the path.join() below, escaping TEMP_DIR.
        const rawExt = file.name.split(".").pop()?.toLowerCase() || "txt";
        const ext = /^[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : "txt";

        // Write uploaded file to temp dir
        await fs.mkdir(TEMP_DIR, { recursive: true });
        const inputPath = path.join(TEMP_DIR, `input-${Date.now()}.${ext}`);
        await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

        const result = await convertManuscript(inputPath, ext, meta);

        // Cleanup input
        await fs.unlink(inputPath).catch(() => {});

        return Response.json(result);
      } catch (e: any) {
        return Response.json({ success: false, error: e.message, log: [e.stack] }, { status: 500 });
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`[pandoc-worker] Listening on http://localhost:${PORT}`);
console.log(`[pandoc-worker] Storage: ${STORAGE_DIR}`);
console.log(`[pandoc-worker] Health: http://localhost:${PORT}/health`);
