/**
 * Loads everything a research-visual PDF needs for one published article:
 * the article record, its published body (for analysis and figures), its
 * reference list, the publisher identity (tenant branding + logo) and the
 * cached research content. Tenant visibility is enforced the same way as
 * the body and data-table routes.
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";
import { logoPngOf, publisherIdentityForJournal, JOURNAL_SELECT } from "@/lib/publisher-identity";
import { APP_BASE_URL } from "@/lib/site";
import { extractFigures, getResearchVisualContent, type ArticleFigure, type ResearchSource } from "@/lib/research-visuals";
import type { ResearchVisualKind, VisualFigure, VisualInput } from "@/lib/research-visuals-pdf";

const MAX_FIGURE_BYTES = 12 * 1024 * 1024;

async function figurePng(f: ArticleFigure): Promise<VisualFigure | null> {
  try {
    const res = await fetch(f.src, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_FIGURE_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_FIGURE_BYTES) return null;
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(bytes)
      .flatten({ background: "#ffffff" })
      .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { number: f.number, caption: f.caption, png: data, width: info.width, height: info.height, isFramework: f.isFramework };
  } catch (e) {
    console.error("[research-visuals] figure fetch failed", f.src, e);
    return null;
  }
}

function bodyFromGalley(html: string): string | null {
  return html.match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/)?.[1] ?? null;
}

export interface LoadedVisual {
  input: VisualInput;
  title: string;
}

/** The article's research source (for warming the cache at publish time). */
export async function researchSourceFor(articleId: string): Promise<ResearchSource | null> {
  const a = await db.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, abstract: true, keywords: true, discipline: true, laySummary: true, galleyHtmlKey: true },
  });
  if (!a) return null;
  const buf = a.galleyHtmlKey ? await getObject(a.galleyHtmlKey).catch(() => null) : null;
  return { ...a, bodyHtml: buf ? bodyFromGalley(buf.toString("utf-8")) : null };
}

export async function loadResearchVisual(id: string, kind: ResearchVisualKind, headers: Headers): Promise<LoadedVisual | null> {
  const tenant = await resolveTenantFromHeaders(headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({
      where: { id },
      select: {
        id: true, status: true, title: true, abstract: true, authors: true, doi: true, keywords: true, discipline: true,
        contentType: true, laySummary: true, publishedAt: true, galleyHtmlKey: true,
        journal: { select: JOURNAL_SELECT },
        issue: { select: { volume: true, issueNumber: true, year: true } },
      },
    })
  );
  if (!article || article.status !== "PUBLISHED") return null;

  const title = article.title.replace(/\s+/g, " ").trim();
  const galley = article.galleyHtmlKey ? await getObject(article.galleyHtmlKey).catch(() => null) : null;
  const bodyHtml = galley ? bodyFromGalley(galley.toString("utf-8")) : null;

  const [identity, references, content] = await Promise.all([
    publisherIdentityForJournal(article.journal),
    kind === "poster"
      ? db.reference.findMany({ where: { articleId: id }, select: { rawText: true }, orderBy: { createdAt: "asc" }, take: 8 }).catch(() => [])
      : Promise.resolve([]),
    getResearchVisualContent({
      id: article.id,
      title,
      abstract: article.abstract,
      keywords: article.keywords,
      discipline: article.discipline,
      laySummary: article.laySummary,
      bodyHtml,
    }),
  ]);

  const tenantTagline = identity.tenantId
    ? (await db.tenant.findUnique({ where: { id: identity.tenantId }, select: { tagline: true } }).catch(() => null))?.tagline ?? null
    : null;

  // Figures: framework figures (reproduced exactly), plus one results figure for the poster.
  const allFigures = extractFigures(bodyHtml);
  const wanted =
    kind === "framework" || kind === "infographic"
      ? allFigures.filter((f) => f.isFramework).slice(0, 3)
      : kind === "poster"
        ? [...allFigures.filter((f) => f.isFramework).slice(0, 1), ...allFigures.filter((f) => !f.isFramework).slice(0, 1)]
        : [];
  const [logoPng, ...figs] = await Promise.all([logoPngOf(identity.logoUrl, 600), ...wanted.map(figurePng)]);

  return {
    title,
    input: {
      article: {
        id: article.id,
        title,
        authors: article.authors,
        doi: article.doi,
        publishedAt: article.publishedAt,
        keywords: article.keywords,
        discipline: article.discipline,
        contentType: article.contentType,
        volume: article.issue?.volume ?? null,
        issueNumber: article.issue?.issueNumber ?? null,
        year: article.issue?.year ?? null,
        articleUrl: `${APP_BASE_URL}/article/${article.id}`,
        references: references.map((r) => r.rawText.replace(/\s+/g, " ").trim()),
      },
      brand: {
        whitelabel: identity.whitelabel,
        orgName: identity.publisher,
        journalName: identity.journalName,
        issn: identity.issn,
        eissn: identity.eissn,
        tagline: tenantTagline,
        email: identity.email,
        primaryHex: identity.primaryHex,
        accentHex: identity.accentHex,
        logoPng,
      },
      content,
      figures: figs.filter((f): f is VisualFigure => !!f),
    },
  };
}
