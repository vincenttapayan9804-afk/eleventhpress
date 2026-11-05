import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyArticleProvenance } from "@/lib/article-provenance-server";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/articles/[id]/verify — public, no auth. JSON counterpart to
 * /verify/article/[id], for programmatic checks. See that page for what
 * "verified" actually means here.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) => tx.article.findUnique({ where: { id } }));
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  if (!article.contentHash) {
    return NextResponse.json({ found: true, sealed: false, title: article.title });
  }

  const { verdict, unavailable, checks } = await verifyArticleProvenance({ ...article, contentHash: article.contentHash });

  return NextResponse.json({
    found: true,
    sealed: true,
    valid: verdict === "verified",
    verdict,
    ...(verdict === "unavailable" ? { unavailableFiles: unavailable } : {}),
    checks,
    checkedAt: new Date().toISOString(),
    sealedAt: article.provenanceSealedAt,
    title: article.title,
    doi: article.doi,
    publishedAt: article.publishedAt,
    contentHash: article.contentHash,
    galleyPdfHash: article.galleyPdfHash,
    galleyEpubHash: article.galleyEpubHash,
    license: "CC BY 4.0",
  });
}
