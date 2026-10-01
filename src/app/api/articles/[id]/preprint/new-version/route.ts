import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { PREPRINT_ELIGIBLE_STATUSES, type ArticleStatus } from "@/lib/article";
import { withRlsContext } from "@/lib/db-rls";
import { depositPreprintVersionToZenodo } from "@/lib/zenodo";

/**
 * POST /api/articles/[id]/preprint/new-version
 * Body: { title?, abstract?, manuscriptKey?, manuscriptName? }
 *
 * Preprint-to-VOR persistent version chain — posts a new, independently-
 * citable version of a preprint the author (or an editor) already opted
 * into public preprint visibility (see POST /api/articles/[id]/preprint).
 * Creates a NEW Article row rather than mutating the existing one, so
 * every version keeps its own DOI permanently resolving to the exact text
 * that DOI was minted for — overwriting v1 in place would silently break
 * every citation already pointing at it.
 *
 * Only offered while the CURRENT (latest) version is still a public
 * preprint in an eligible pre-publication status — same gate POST
 * .../preprint already applies, since a version chain anchored on a
 * withdrawn/rejected/already-published article has nothing left to
 * revise as a preprint.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    abstract?: string;
    manuscriptKey?: string;
    manuscriptName?: string;
  };

  const article = await withRlsContext(session, (tx) => tx.article.findUnique({ where: { id } }));
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isEditor = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role);
  const isOwner = article.correspondingAuthorId === session.userId;
  if (!isEditor && !isOwner) {
    return NextResponse.json({ error: "Not authorized for this article" }, { status: 403 });
  }

  if (!article.isPreprint) {
    return NextResponse.json({ error: "This article isn't currently posted as a preprint" }, { status: 400 });
  }
  if (!PREPRINT_ELIGIBLE_STATUSES.includes(article.status as ArticleStatus)) {
    return NextResponse.json(
      { error: `Cannot post a new preprint version while status is ${article.status}` },
      { status: 400 }
    );
  }

  const chainRootId = article.versionOfId ?? article.id;

  const newVersion = await db.article.create({
    data: {
      journalId: article.journalId,
      issueId: null,
      doi: null,
      doiStatus: "DRAFT",
      title: body.title?.trim() || article.title,
      abstract: body.abstract?.trim() || article.abstract,
      keywords: article.keywords,
      discipline: article.discipline,
      contentType: article.contentType,
      insightCategory: article.insightCategory,
      keyTakeaways: article.keyTakeaways,
      authors: article.authors,
      correspondingAuthorId: article.correspondingAuthorId,
      manuscriptKey: body.manuscriptKey || article.manuscriptKey,
      status: article.status,
      reviewModel: article.reviewModel,
      openReview: article.openReview,
      funders: article.funders,
      apcWaiverRequested: article.apcWaiverRequested,
      apcWaiverReason: article.apcWaiverReason,
      apcWaiverStatus: article.apcWaiverStatus,
      rightsRetentionConfirmed: article.rightsRetentionConfirmed,
      rightsRetentionConfirmedAt: article.rightsRetentionConfirmedAt,
      dataAvailabilityStatement: article.dataAvailabilityStatement,
      authorConflictOfInterest: article.authorConflictOfInterest,
      isPreprint: true,
      preprintPostedAt: new Date(),
      versionNumber: article.versionNumber + 1,
      versionOfId: chainRootId,
      submittedAt: article.submittedAt,
    },
  });

  const deposit = await depositPreprintVersionToZenodo(newVersion.id);

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "PREPRINT_NEW_VERSION",
      entityType: "ARTICLE",
      entityId: newVersion.id,
      articleId: newVersion.id,
      metadata: JSON.stringify({
        previousVersionId: article.id,
        versionOfId: chainRootId,
        versionNumber: newVersion.versionNumber,
        depositOk: deposit.ok,
        doi: deposit.doi,
      }),
    },
  });

  return NextResponse.json({
    article: {
      id: newVersion.id,
      versionNumber: newVersion.versionNumber,
      doi: deposit.ok ? deposit.doi : newVersion.doi,
      doiMode: deposit.mode,
    },
  });
}
