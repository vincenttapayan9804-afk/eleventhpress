import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDoiBatchXml } from "@/lib/crossref";
import { APP_BASE_URL } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/crossref/xml/[id]
 * Returns the Crossref <doi_batch> XML that *would* be deposited for an
 * article. Editors use this to preview and validate the deposit payload
 * before submitting it to the Crossref test endpoint.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findUnique({
      where: { id },
      include: { journal: true, issue: true },
    })
  );
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const xml = buildDoiBatchXml({
    article,
    articleUrl: `${APP_BASE_URL}/article/${article.id}`,
  });

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
