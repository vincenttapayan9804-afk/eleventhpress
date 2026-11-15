import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildBibTeX, buildRis, type ExportableArticle } from "@/lib/citation-export";
import { resolveTenantFromHeaders, tenantBaseUrl } from "@/lib/tenant";
import { publisherIdentityForJournal } from "@/lib/publisher-identity";
import { corpusArticleWhere } from "@/lib/research-assistant-settings";
import { cleanSourceIds } from "@/lib/research-query";

/**
 * GET /api/corpus-chat/citations?ids=a,b,c&format=ris|bibtex — the sources
 * of a Research Assistant answer (or a whole notebook) as one file for a
 * reference manager (Zotero, Mendeley, EndNote import RIS; LaTeX and
 * Zotero import BibTeX). Only the institution's own published articles
 * are included; unknown ids are skipped.
 */
const MAX_IDS = 60;

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "ris" && format !== "bibtex") {
    return NextResponse.json({ error: "format must be 'ris' or 'bibtex'" }, { status: 400 });
  }
  const ids = cleanSourceIds((req.nextUrl.searchParams.get("ids") ?? "").split(","), MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ error: "ids is required" }, { status: 400 });

  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const rows = await db.article.findMany({
    where: { ...corpusArticleWhere(tenant?.id ?? null, null), id: { in: ids } } as any,
    include: { journal: true, issue: true },
  });
  if (rows.length === 0) return NextResponse.json({ error: "No published articles found" }, { status: 404 });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => !!r);

  const identities = new Map<string, Awaited<ReturnType<typeof publisherIdentityForJournal>>>();
  const bases = new Map<string, string>();
  const entries: string[] = [];
  for (const a of ordered) {
    const jKey = a.journal?.id ?? "";
    if (!identities.has(jKey)) identities.set(jKey, await publisherIdentityForJournal(a.journal ?? null));
    const tKey = a.journal?.tenantId ?? "";
    if (!bases.has(tKey)) bases.set(tKey, await tenantBaseUrl(a.journal?.tenantId ?? null));
    const identity = identities.get(jKey)!;
    const exportable: ExportableArticle = {
      id: a.id,
      title: a.title,
      authors: a.authors,
      publishedAt: a.publishedAt,
      doi: a.doi,
      journalName: a.journal?.name || identity.journalName,
      journalIssn: a.journal?.issn || identity.issn,
      volume: a.issue?.volume,
      issueNumber: a.issue?.issueNumber,
      year: a.issue?.year,
      abstract: a.abstract,
      keywords: a.keywords,
      discipline: a.discipline,
      publisher: identity.publisher,
      articleUrl: `${bases.get(tKey)}/article/${a.id}`,
    };
    entries.push(format === "ris" ? buildRis(exportable) : buildBibTeX(exportable));
  }
  const body = format === "ris" ? entries.map((e) => e.replace(/\s+$/, "")).join("\r\n\r\n") + "\r\n" : entries.map((e) => e.trim()).join("\n\n") + "\n";
  const name = `research-assistant-sources-${new Date().toISOString().slice(0, 10)}.${format === "ris" ? "ris" : "bib"}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": `${format === "ris" ? "application/x-research-info-systems" : "application/x-bibtex"}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
