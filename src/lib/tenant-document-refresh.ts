/**
 * Re-renders a whitelabel tenant's published article galleys after it
 * changes its branding or journal details, so PDFs/HTML/EPUB/JATS already
 * out in the world pick up the new name, ISSN, colours and logo instead of
 * keeping the old ones until someone republishes.
 *
 * Every article is first marked stale (galleyTemplateVersion = 0), then up
 * to `limit` are re-rendered right away; anything left over is picked up
 * by the next production build's backfill (scripts/backfill-galleys.ts),
 * which treats a stale version as "needs galleys". Failures are logged,
 * never thrown — a branding save must never fail because a render did.
 */
import { db } from "@/lib/db";
import { GALLEY_TEMPLATE_VERSION } from "@/lib/galley";
import { generateGalleysForArticle } from "@/lib/galley-regenerate";
import { resealArticleProvenanceSafely } from "@/lib/article-provenance-server";

async function renderOne(id: string): Promise<boolean> {
  try {
    const result = await generateGalleysForArticle(id);
    if (!result) return false;
    await db.article.update({
      where: { id },
      data: {
        galleyHtmlKey: result.htmlKey,
        galleyPdfKey: result.pdfKey,
        galleyJatsKey: result.jatsKey,
        galleyEpubKey: result.epubKey,
        galleyTemplateVersion: GALLEY_TEMPLATE_VERSION,
      },
    });
    await resealArticleProvenanceSafely(id, "tenant-branding-changed");
    return true;
  } catch (e) {
    console.error(`[tenant-document-refresh] galley re-render failed for ${id}`, e);
    return false;
  }
}

/** Re-renders stale whitelabel galleys (oldest-edited first), at most `limit`, within `budgetMs`. */
async function renderStale(where: object, limit: number, budgetMs: number): Promise<number> {
  const started = Date.now();
  const articles = await db.article
    .findMany({ where: { ...where, galleyTemplateVersion: { lt: GALLEY_TEMPLATE_VERSION } }, select: { id: true }, orderBy: { updatedAt: "desc" }, take: limit })
    .catch(() => []);
  let rendered = 0;
  for (const { id } of articles) {
    if (Date.now() - started > budgetMs) break;
    if (await renderOne(id)) rendered++;
  }
  return rendered;
}

/** After a tenant's branding/journal change: mark its galleys stale and re-render what fits now. */
export async function refreshTenantGalleys(tenantId: string, limit = 6, budgetMs = 40_000): Promise<{ marked: number; rendered: number }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { isPlatform: true } }).catch(() => null);
  if (!tenant || tenant.isPlatform) return { marked: 0, rendered: 0 };

  const where = { status: "PUBLISHED", journal: { tenantId } };
  const marked = await db.article
    .updateMany({ where, data: { galleyTemplateVersion: 0 } })
    .then((r) => r.count)
    .catch((e) => {
      console.error("[tenant-document-refresh] mark stale failed", e);
      return 0;
    });
  if (!marked) return { marked: 0, rendered: 0 };
  return { marked, rendered: await renderStale(where, limit, budgetMs) };
}

/** Daily safety net (cron/galley-sweep): keeps working through any tenant galleys still stale. */
export async function sweepStaleTenantGalleys(limit = 6, budgetMs = 40_000): Promise<{ rendered: number }> {
  const tenants = await db.tenant.findMany({ where: { isPlatform: false }, select: { id: true } }).catch(() => []);
  if (!tenants.length) return { rendered: 0 };
  const where = { status: "PUBLISHED", journal: { tenantId: { in: tenants.map((t) => t.id) } } };
  return { rendered: await renderStale(where, limit, budgetMs) };
}
