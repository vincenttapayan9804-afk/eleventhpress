import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { APP_BASE_URL } from "@/lib/site";
import { loadJournalInfo } from "@/lib/research-assistant";
import { apaReference, toSource } from "@/lib/answer-integrity";
import { cleanSourceIds } from "@/lib/research-query";
import {
  buildResearchDocx,
  buildResearchPdf,
  reportFileName,
  reportMarkdown,
  type ReportCitation,
  type ReportItem,
  type ResearchReport,
} from "@/lib/research-export";

/**
 * POST /api/corpus-chat/export — downloads a Research Assistant answer
 * (scope "response") or a whole conversation (scope "conversation") as a
 * branded PDF, an editable Word document or Markdown.
 *
 * The browser sends the questions, answers and which evidence each answer
 * cited. Everything bibliographic is rebuilt here from the journal's own
 * records: titles, authors, dates, DOIs, links and the cited passage text.
 * A citation to an article that isn't published, or a passage that no
 * longer exists, is left out rather than trusted.
 */
export const maxDuration = 30;

const FORMATS = new Set(["pdf", "docx", "md"]);
const MAX_ITEMS = 60;

interface ClientCitation {
  n?: unknown;
  articleId?: unknown;
  chunkId?: unknown;
  kind?: unknown;
}

export async function POST(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`corpus-chat-export:${ip}`, 20, 600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  let body: { format?: unknown; title?: unknown; scope?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const format = typeof body.format === "string" && FORMATS.has(body.format) ? (body.format as "pdf" | "docx" | "md") : null;
  if (!format) return NextResponse.json({ error: "format must be pdf, docx or md" }, { status: 400 });
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  const items = rawItems.filter(
    (i: any) => i && typeof i.question === "string" && i.question.trim() && typeof i.answer === "string" && i.answer.trim()
  );
  if (items.length === 0) return NextResponse.json({ error: "Nothing to export" }, { status: 400 });

  // Evidence to verify against the database.
  const articleIds = new Set<string>();
  const chunkIds = new Set<string>();
  for (const it of items as any[]) {
    for (const c of (Array.isArray(it.citations) ? it.citations : []) as ClientCitation[]) {
      for (const id of cleanSourceIds([c?.articleId])) articleIds.add(id);
      for (const id of cleanSourceIds([c?.chunkId])) chunkIds.add(id);
    }
  }
  const [records, chunks, journal] = await Promise.all([
    db.article.findMany({
          where: { id: { in: [...articleIds] }, status: "PUBLISHED" },
          select: {
            id: true,
            title: true,
            authors: true,
            abstract: true,
            keywords: true,
            doi: true,
            publishedAt: true,
            discipline: true,
            issue: { select: { volume: true, issueNumber: true } },
          },
        }),
    db.articleChunk.findMany({ where: { id: { in: [...chunkIds] }, article: { status: "PUBLISHED" } }, select: { id: true, articleId: true, text: true } }),
    loadJournalInfo(),
  ]);
  const recordById = new Map(records.map((r) => [r.id, r]));
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  const sourceById = new Map(
    records.map((r) => {
      const s = toSource({ ...r, label: "", volume: r.issue?.volume, issueNumber: r.issue?.issueNumber }, 0, APP_BASE_URL);
      return [
        r.id,
        { id: r.id, title: r.title, url: s.url, reference: apaReference(s, { name: journal.name, volume: r.issue?.volume, issueNumber: r.issue?.issueNumber }) },
      ];
    })
  );

  const reportItems: ReportItem[] = (items as any[]).map((it) => {
    const citations: ReportCitation[] = [];
    const warnings = Array.isArray(it.warnings) ? it.warnings.filter((w: unknown) => typeof w === "string").slice(0, 6).map((w: string) => w.slice(0, 300)) : [];
    let missing = 0;
    for (const c of (Array.isArray(it.citations) ? it.citations : []).slice(0, 40) as ClientCitation[]) {
      const n = Number(c?.n);
      const articleId = typeof c?.articleId === "string" ? c.articleId : "";
      const record = recordById.get(articleId);
      if (!Number.isInteger(n) || n < 1 || !record) {
        missing++;
        continue;
      }
      const chunk = typeof c?.chunkId === "string" ? chunkById.get(c.chunkId) : undefined;
      if (c?.kind === "passage" && chunk && chunk.articleId === articleId) {
        citations.push({ n, sourceId: articleId, kind: "passage", text: chunk.text });
      } else {
        const abstract = (record.abstract || record.title).trim();
        citations.push({ n, sourceId: articleId, kind: "record", text: abstract.length > 420 ? `${abstract.slice(0, 420)}…` : abstract });
      }
    }
    if (missing) warnings.push(`${missing === 1 ? "One citation refers" : `${missing} citations refer`} to an article that is no longer available in the journal.`);
    const sourceIds = [...new Set(citations.map((c) => c.sourceId))];
    const status = ["verified", "review", "unsupported"].includes(it.evidenceStatus) ? it.evidenceStatus : undefined;
    return {
      question: String(it.question).slice(0, 2000),
      answer: String(it.answer).slice(0, 20_000),
      citations,
      sources: sourceIds.map((id) => sourceById.get(id)!).filter(Boolean),
      evidenceStatus: status && missing && status === "verified" ? "review" : status,
      warnings,
      answeredAt: typeof it.answeredAt === "string" ? it.answeredAt : null,
    };
  });

  const scope = body.scope === "conversation" ? "conversation" : "response";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.replace(/\s+/g, " ").trim().slice(0, 140)
      : scope === "conversation"
        ? "Research conversation"
        : "Research brief";
  const report: ResearchReport = { title, scope, items: reportItems, journal, generatedAt: new Date(), siteUrl: APP_BASE_URL };

  try {
    if (format === "md") {
      return new NextResponse(reportMarkdown(report), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportFileName(report, "md")}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const buffer = format === "pdf" ? await buildResearchPdf(report) : await buildResearchDocx(report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${reportFileName(report, format)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[corpus-chat] export failed:", e);
    return NextResponse.json({ error: "The report couldn't be generated. Please try again." }, { status: 500 });
  }
}
