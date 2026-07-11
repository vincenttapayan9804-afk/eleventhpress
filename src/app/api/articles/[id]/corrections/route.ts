import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { correctionTypeToIntegrityStatus, CorrectionType, CORRECTION_TYPE_LABELS } from "@/lib/article";
import { depositToCrossref, depositCrossmarkUpdate } from "@/lib/crossref";

/**
 * GET /api/articles/[id]/corrections
 * Public: the correction/retraction/erratum history for an article, newest first.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const corrections = await db.correction.findMany({
    where: { articleId: id },
    orderBy: { issuedAt: "desc" },
    include: { issuedBy: { select: { fullName: true, role: true } } },
  });
  return NextResponse.json({ corrections });
}

/**
 * POST /api/articles/[id]/corrections
 * Body: { type: CorrectionType, title, description }
 *
 * Editor-only. Mints a DOI for the correction notice, deposits it to
 * Crossref as its own journal_article record, then re-deposits the
 * ORIGINAL article's DOI with a Crossmark <update> pointing at the new
 * notice (see docs/standards.md and src/lib/crossref.ts). Updates the
 * original article's integrityStatus so the public article page can
 * show a banner without waiting on Crossref's own indexing latency.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id } = await params;
  const { type, title, description } = (await req.json()) as {
    type: CorrectionType;
    title: string;
    description: string;
  };

  if (!type || !CORRECTION_TYPE_LABELS[type]) {
    return NextResponse.json({ error: "Invalid correction type" }, { status: 400 });
  }
  if (!title || !description) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }

  const article = await db.article.findUnique({
    where: { id },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (article.status !== "PUBLISHED" || !article.doi) {
    return NextResponse.json({ error: "Only published articles with a DOI can receive a correction" }, { status: 400 });
  }

  const suffix = Math.floor(Math.random() * 90000) + 10000;
  const noticeDoi = `10.52011/epip.correction.${suffix}`;
  const articleUrl = `https://eleventhpress.org/article/${article.id}`;
  const issuedAt = new Date();

  // Deposit the correction/retraction notice as its own Crossref record.
  const noticeArticle = {
    ...article,
    id: `${article.id}-correction-${suffix}`,
    doi: noticeDoi,
    title: `${CORRECTION_TYPE_LABELS[type]}: ${article.title}`,
    abstract: description,
    publishedAt: issuedAt,
  };
  const noticeDeposit = await depositToCrossref({ article: noticeArticle, articleUrl });

  // Re-deposit the original article's DOI with a Crossmark update pointing
  // at the new notice.
  const crossmarkDeposit = await depositCrossmarkUpdate({
    article,
    articleUrl,
    updateDoi: noticeDoi,
    updateType: type.toLowerCase() as "corrigendum" | "erratum" | "expression_of_concern" | "retraction",
    updateDate: issuedAt,
  });

  const correction = await db.correction.create({
    data: {
      articleId: article.id,
      type,
      title,
      description,
      doi: noticeDoi,
      issuedById: session.userId,
      issuedAt,
      crossmarkRegisteredAt: crossmarkDeposit.ok ? issuedAt : null,
      crossrefDepositLog: JSON.stringify({ notice: noticeDeposit, crossmark: crossmarkDeposit }),
    },
  });

  await db.article.update({
    where: { id: article.id },
    data: { integrityStatus: correctionTypeToIntegrityStatus(type) },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "CORRECTION_ISSUED",
      entityType: "ARTICLE",
      entityId: article.id,
      articleId: article.id,
      metadata: JSON.stringify({ type, correctionId: correction.id, noticeDoi }),
    },
  });

  if (article.correspondingAuthorId) {
    await db.notification.create({
      data: {
        userId: article.correspondingAuthorId,
        type: type === "RETRACTION" ? "ERROR" : "WARNING",
        title: `${CORRECTION_TYPE_LABELS[type]} issued`,
        message: `A ${CORRECTION_TYPE_LABELS[type].toLowerCase()} has been issued for "${article.title}": ${title}`,
        articleId: article.id,
      },
    });
  }

  return NextResponse.json({ correction, noticeDeposit, crossmarkDeposit });
}
