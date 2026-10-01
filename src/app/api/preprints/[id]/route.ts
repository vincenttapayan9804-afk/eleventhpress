import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuthorAvatars } from "@/lib/author-accounts";
import { parseAuthors } from "@/lib/article";
import { PREPRINT_ELIGIBLE_STATUSES } from "@/lib/article";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET /api/preprints/[id]
 *
 * Public preprint detail — same reader-safe-fields-only contract as
 * GET /api/preprints (see that route's doc comment). 404s (not just an
 * empty body) once an article stops being a public preprint — published,
 * withdrawn, rejected, or never opted in — same "don't leak state via a
 * different status code" discipline as the main article route.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers);
  const article = await withTenantRlsContext(tenant?.id ?? null, (tx) => tx.article.findUnique({ where: { id } }));
  if (!article || !article.isPreprint || !PREPRINT_ELIGIBLE_STATUSES.includes(article.status as any)) {
    return NextResponse.json({ error: "Preprint not found" }, { status: 404 });
  }

  const authorAvatars = await resolveAuthorAvatars(parseAuthors(article.authors));

  // Preprint-to-VOR version chain — every other version sharing the same
  // chain root (versionOfId ?? id), oldest first, so a reader can jump
  // between a preprint's independently-citable versions.
  const chainRootId = article.versionOfId ?? article.id;
  const versions = await withTenantRlsContext(tenant?.id ?? null, (tx) =>
    tx.article.findMany({
      where: { OR: [{ id: chainRootId }, { versionOfId: chainRootId }] },
      select: { id: true, versionNumber: true, doi: true, preprintPostedAt: true },
      orderBy: { versionNumber: "asc" },
    })
  );

  return NextResponse.json({
    id: article.id,
    title: article.title,
    abstract: article.abstract,
    keywords: article.keywords,
    discipline: article.discipline,
    authors: article.authors,
    authorAvatars,
    status: article.status,
    preprintPostedAt: article.preprintPostedAt,
    hasManuscript: !!article.manuscriptKey,
    versionNumber: article.versionNumber,
    doi: article.doi,
    versions,
  });
}
