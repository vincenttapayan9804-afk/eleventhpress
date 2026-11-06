/**
 * Loads a published article's body tables — the single source both the
 * Supplemental tab's JSON (GET /api/articles/[id]/data-tables) and each
 * table's PDF export (…/data-tables/[n]/pdf) read from, so "Table 3" is the
 * same table in both places. Extracts from the published HTML galley's
 * article-body div, the same content GET /api/articles/[id]/body serves.
 */
import { getObject } from "@/lib/storage";
import { extractTables, isChartable, type ExtractedTable } from "@/lib/data-tables";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

export type ArticleTable = ExtractedTable & { chartable: boolean };

export async function loadPublishedArticleTables(id: string, headers: Headers): Promise<ArticleTable[] | null> {
  const tenant = await resolveTenantFromHeaders(headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({ where: { id }, select: { status: true, galleyHtmlKey: true } })
  );
  if (!article || article.status !== "PUBLISHED") return null;
  if (!article.galleyHtmlKey) return [];

  const buf = await getObject(article.galleyHtmlKey);
  if (!buf) return [];
  const match = buf.toString("utf-8").match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/);
  if (!match) return [];
  return extractTables(match[1]).map((t) => ({ ...t, chartable: isChartable(t) }));
}
