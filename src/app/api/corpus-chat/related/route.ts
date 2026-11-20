import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { corpusArticleWhere } from "@/lib/research-assistant-settings";
import { cleanSourceIds } from "@/lib/research-query";
import { discoverAcrossSources, withOpenAccessLinks } from "@/lib/open-discovery";
import { outsideJournal, relatedWorkQuery } from "@/lib/related-work";

/**
 * GET /api/corpus-chat/related?q=question&ids=a,b — related work beyond
 * this journal for a Research Assistant answer, from open scholarly
 * indexes (Crossref, OpenAlex, Semantic Scholar, ERIC, PubMed Central,
 * Europe PMC, Zenodo, and CORE when configured), via the same fan-out as
 * /api/discover. Results with a DOI but no open-access link get one from
 * Unpaywall when it knows a legal free copy.
 *
 * Shown only when the reader asks for it, labelled as outside the journal,
 * and never given to the model: answers stay grounded in the journal's
 * own articles. The journal's own articles are dropped from the list.
 */
export const maxDuration = 20;

const PER_SOURCE = 4;
const MAX_RESULTS = 12;

export async function GET(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`corpus-chat-related:${ip}`, 20, 600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const question = (req.nextUrl.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const ids = cleanSourceIds((req.nextUrl.searchParams.get("ids") ?? "").split(","), 8);
  if (question.length < 3) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const cited = ids.length
    ? await db.article.findMany({
        where: { ...corpusArticleWhere(tenant?.id ?? null, null), id: { in: ids } } as any,
        select: { keywords: true },
      })
    : [];
  const keywords = cited.flatMap((a) => (a.keywords ?? "").split(/[,;]/)).map((k) => k.trim()).filter(Boolean);
  const query = relatedWorkQuery(question, keywords);
  if (query.length < 3) return NextResponse.json({ query, results: [] });

  const { results } = await discoverAcrossSources(query, PER_SOURCE);
  const dois = results.map((r) => r.doi).filter((d): d is string => !!d);
  const own = dois.length
    ? await db.article.findMany({
        where: { doi: { in: [...new Set(dois.flatMap((d) => [d, d.toLowerCase()]))] } },
        select: { doi: true },
      })
    : [];

  const listed = await withOpenAccessLinks(outsideJournal(results, own.map((a) => a.doi!).filter(Boolean), MAX_RESULTS, query));
  return NextResponse.json(
    { query, results: listed },
    // Per reader and per question: the browser may reuse a repeat briefly.
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
