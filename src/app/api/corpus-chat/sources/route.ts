import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
import { corpusArticleWhere } from "@/lib/research-assistant-settings";
import { loadJournalInfo } from "@/lib/research-assistant";
import { cleanSourceIds } from "@/lib/research-query";
import { CITATION_STYLES, formatCitationStyle, type CitationStyleId } from "@/lib/citation-styles";
import { loadSourceSignals } from "@/lib/source-signals";

/**
 * GET /api/corpus-chat/sources?ids=a,b,c&style=mla — scholarly signals for
 * the sources of a Research Assistant answer: correction and retraction
 * notices, references that have since been retracted, citation counts
 * (OpenAlex) and community reviews, plus each source's reference in the
 * chosen citation style.
 *
 * Loaded after the answer, so it never slows the answer down. Only the
 * institution's own published articles are included; unknown ids are
 * skipped. Nothing here is given to the model.
 */
export const maxDuration = 20;

const MAX_IDS = 12;
const STYLE_IDS = new Set<string>(CITATION_STYLES.map((s) => s.id));

export async function GET(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`corpus-chat-sources:${ip}`, 60, 600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  const ids = cleanSourceIds((req.nextUrl.searchParams.get("ids") ?? "").split(","), MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ error: "ids is required" }, { status: 400 });
  const rawStyle = req.nextUrl.searchParams.get("style") ?? "apa";
  const style = (STYLE_IDS.has(rawStyle) ? rawStyle : "apa") as CitationStyleId;

  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const rows = await db.article.findMany({
    where: { ...corpusArticleWhere(tenant?.id ?? null, null), id: { in: ids } } as any,
    select: {
      id: true,
      title: true,
      authors: true,
      doi: true,
      publishedAt: true,
      anonymizedReviewHistory: true,
      journal: { select: { name: true, issn: true } },
      issue: { select: { volume: true, issueNumber: true, year: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => !!r);
  const journal = await loadJournalInfo(tenant && !tenant.isPlatform ? tenant.id : null);

  const signals = await loadSourceSignals(ordered.map((a) => ({ id: a.id, doi: a.doi, anonymizedReviewHistory: a.anonymizedReviewHistory })));
  const sources = signals.map((s, i) => {
    const a = ordered[i];
    // APA comes with the answer itself; other styles are rendered here.
    const reference =
      style === "apa"
        ? null
        : formatCitationStyle(
            {
              title: a.title,
              authors: a.authors,
              publishedAt: a.publishedAt,
              doi: a.doi,
              journalName: a.journal?.name || journal.name,
              journalIssn: a.journal?.issn || journal.issn,
              volume: a.issue?.volume,
              issueNumber: a.issue?.issueNumber,
              year: a.issue?.year,
            },
            style
          );
    return { ...s, reference };
  });

  return NextResponse.json(
    { style, sources },
    { headers: { "Cache-Control": tenantCacheControl(req, tenant, "public, s-maxage=3600, stale-while-revalidate=86400") } }
  );
}
