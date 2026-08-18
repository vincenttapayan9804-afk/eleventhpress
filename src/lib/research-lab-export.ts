/**
 * Export suite for Eleventh Research Lab outputs (Gap Finder / Systematic
 * Review-PRISMA drafting tool) — a saved ResearchLabDocument can be pulled
 * out of the platform as plain Markdown, a formatted PDF, or a BibTeX/RIS
 * bibliography of its sources, so a researcher isn't stuck copy-pasting out
 * of the dashboard UI. Same "never fabricate what we don't have" posture as
 * the tools that produce these documents: the bibliography only ever emits
 * real bibliographic data (this platform's own article records for internal
 * sources, whatever metadata the researcher/discovery-search actually
 * supplied for external ones) — never an invented author or year.
 */
import PDFDocument from "pdfkit";
import { db } from "@/lib/db";
import { buildBibTeX, buildRis, buildBibTeXExternal, buildRisExternal } from "@/lib/citation-export";

export interface ResearchLabExportDoc {
  kind: string; // "GAP_ANALYSIS" | "PRISMA_DRAFT"
  title: string;
  createdAt: Date;
  inputJson: string;
  resultJson: string;
  model: string | null;
}

interface ResultSourceRef {
  kind: "internal" | "external";
  id: string;
  title: string;
}

/** Renders a document's body as plain Markdown — the PRISMA tool's result
 * is already a markdown draft; the Gap Finder's overview/gaps are
 * assembled into the same shape here so both tools share one export path. */
export function buildExportMarkdown(doc: ResearchLabExportDoc): string {
  const result = JSON.parse(doc.resultJson) as { draft?: string; overview?: string; gaps?: { gap: string; explanation: string }[] };
  if (doc.kind === "PRISMA_DRAFT") {
    return result.draft ?? "";
  }
  const lines = [`# ${doc.title}`, ""];
  if (result.overview) lines.push(result.overview, "");
  for (const g of result.gaps ?? []) {
    lines.push(`## ${g.gap}`, g.explanation, "");
  }
  return lines.join("\n");
}

/** Renders the document as a simple, legible PDF — plain text flow (no
 * branded certificate styling), since this is a working research draft to
 * revise and print, not a credential. Reuses the same PDFKit + Promise-
 * collection pattern as src/lib/certificate-pdf.ts. */
export async function buildExportPdf(doc: ResearchLabExportDoc): Promise<Buffer> {
  const body = buildExportMarkdown(doc);
  const pdf = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    bufferPages: true,
    info: { Title: doc.title },
  });
  const result: Promise<Buffer> = new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  pdf.font("Helvetica-Bold").fontSize(16).fillColor("#241b3a").text(doc.title);
  pdf.moveDown(0.3);
  pdf.font("Helvetica").fontSize(9).fillColor("#6b6478")
    .text(`Generated ${doc.createdAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}${doc.model ? ` · ${doc.model}` : ""} · Eleventh Research Lab`);
  pdf.moveDown(1);
  pdf.font("Helvetica").fontSize(10.5).fillColor("#1a1425").text(body, { lineGap: 3 });
  pdf.end();
  return result;
}

/**
 * Builds a combined BibTeX/RIS bibliography of every source a document
 * drew on. Internal sources are re-resolved against the real Article
 * table so the entry carries full structured metadata (same builder the
 * article page's own Cite panel uses); external sources fall back to
 * whatever metadata was captured in the document's own inputJson at
 * generation time (a best-effort match by URL — a source that redirected
 * during fetch may not carry every original field, but the entry never
 * invents a field it doesn't have).
 */
export async function buildExportBibliography(doc: ResearchLabExportDoc, format: "bibtex" | "ris"): Promise<string> {
  const result = JSON.parse(doc.resultJson) as { sources?: ResultSourceRef[] };
  const input = JSON.parse(doc.inputJson) as {
    externalSources?: { url: string; title?: string; authors?: string; year?: number | null; venue?: string | null }[];
  };
  const externalByUrl = new Map((input.externalSources ?? []).map((s) => [s.url, s]));
  const sources = result.sources ?? [];

  const internalIds = sources.filter((s) => s.kind === "internal").map((s) => s.id);
  const articles = internalIds.length
    ? await db.article.findMany({ where: { id: { in: internalIds } }, include: { journal: true, issue: true } })
    : [];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const entries: string[] = [];
  for (const s of sources) {
    if (s.kind === "internal") {
      const a = articleById.get(s.id);
      if (!a) continue;
      const exportable = {
        title: a.title,
        authors: a.authors,
        publishedAt: a.publishedAt,
        doi: a.doi,
        journalName: a.journal?.name,
        journalIssn: a.journal?.issn,
        volume: a.issue?.volume,
        issueNumber: a.issue?.issueNumber,
        year: a.issue?.year,
      };
      entries.push(format === "bibtex" ? buildBibTeX(exportable) : buildRis(exportable));
    } else {
      const meta = externalByUrl.get(s.id) ?? { url: s.id, title: s.title };
      entries.push(format === "bibtex" ? buildBibTeXExternal(meta) : buildRisExternal(meta));
    }
  }
  return entries.join("\n\n");
}
