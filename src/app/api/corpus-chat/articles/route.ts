import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
import { corpusArticleWhere } from "@/lib/research-assistant-settings";

/**
 * GET /api/corpus-chat/articles?q=…&ids=a,b — the institution's published
 * articles a reader can limit the Research Assistant to ("Only these
 * articles"): title matches for q (newest first), or the given ids.
 */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[\w-]{1,64}$/.test(id))
    .slice(0, 12);
  const where: Record<string, unknown> = corpusArticleWhere(tenant?.id ?? null, null);
  if (ids.length) where.id = { in: ids };
  else if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { keywords: { contains: q, mode: "insensitive" } }];
  try {
    const rows = await db.article.findMany({
      where: where as any,
      orderBy: { publishedAt: "desc" },
      take: ids.length ? ids.length : 12,
      select: { id: true, title: true, publishedAt: true, discipline: true },
    });
    return NextResponse.json(
      {
        articles: rows.map((r) => ({
          id: r.id,
          title: r.title,
          year: r.publishedAt ? new Date(r.publishedAt).getUTCFullYear() : null,
          discipline: r.discipline,
        })),
      },
      { headers: { "Cache-Control": tenantCacheControl(req, tenant, "public, s-maxage=60, stale-while-revalidate=600") } }
    );
  } catch (e) {
    console.error("[corpus-chat] article search failed:", e);
    return NextResponse.json({ articles: [] });
  }
}
