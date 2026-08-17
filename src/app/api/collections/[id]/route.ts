import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/collections/[id]
 *
 * Public detail — a published Collection's own info plus its member
 * articles (safe list-item fields, same shape used elsewhere for article
 * cards). 404s for an unpublished collection, same "don't leak state via
 * a different status code" discipline used across this codebase's other
 * public read routes.
 *
 * Whitelabel Phase 8 — scoped by the resolved tenant, matching GET
 * /api/collections; an id/slug from a different tenant 404s at the app
 * layer, and the read runs inside withTenantRlsContext.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const tenantId = tenant?.id ?? null;
  const collection = await withTenantRlsContext(tenantId, (tx) =>
    tx.collection.findFirst({
      where: { OR: [{ id }, { slug: id }], publishedAt: { not: null }, tenantId },
      include: {
        articles: {
          orderBy: { order: "asc" },
          include: {
            article: {
              select: { id: true, title: true, abstract: true, discipline: true, authors: true, citations: true, views: true, doi: true },
            },
          },
        },
      },
    })
  );
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    publishedAt: collection.publishedAt,
    articles: collection.articles.map((ca) => ca.article),
  });
}
