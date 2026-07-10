import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { buildDoiBatchXml, depositToCrossref } from "@/lib/crossref";

/**
 * POST /api/crossref-deposit
 * Body: { articleId, mode?: "sandbox" | "production" }
 *
 * Builds a full <doi_batch> XML deposit for the article and POSTs it
 * to the Crossref sandbox (api.test.crossref.org). Records the result
 * on the Article row and in the AuditLog.
 *
 * Editors + Admins only.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { articleId } = (await req.json()) as { articleId: string };

  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (!article.doi) {
    return NextResponse.json({ error: "Article has no DOI to deposit" }, { status: 400 });
  }

  // Build the XML deposit
  const xml = buildDoiBatchXml(article, article.journal, article.issue);

  // POST to Crossref sandbox
  const result = await depositToCrossref(xml, `epip-${article.id.slice(-12)}-${Date.now()}`);

  // Persist result
  await db.article.update({
    where: { id: articleId },
    data: {
      crossrefBatchId: result.batchId,
      crossrefDepositedAt: new Date(),
      crossrefDepositLog: JSON.stringify({
        success: result.success,
        message: result.message,
        statusUrl: result.statusUrl,
        rawResponse: result.rawResponse,
        depositedAt: new Date().toISOString(),
        endpoint: "https://api.test.crossref.org/deposits",
        mode: "sandbox",
      }),
      doiStatus: result.success ? "REGISTERED" : article.doiStatus,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "CROSSREF_DEPOSIT",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({
        success: result.success,
        batchId: result.batchId,
        doi: article.doi,
        message: result.message,
        endpoint: "sandbox",
      }),
    },
  });

  // Notify editor of result
  await db.notification.create({
    data: {
      userId: session.userId,
      type: result.success ? "SUCCESS" : "ERROR",
      title: result.success ? "Crossref deposit accepted" : "Crossref deposit failed",
      message: result.success
        ? `Deposit for "${article.title}" accepted by the Crossref sandbox. Batch ID: ${result.batchId}. DOI ${article.doi} is now in REGISTERED state.`
        : `Deposit for "${article.title}" failed: ${result.message}`,
      articleId,
    },
  });

  return NextResponse.json({
    ...result,
    articleId,
    doi: article.doi,
    doiStatus: result.success ? "REGISTERED" : article.doiStatus,
  });
}

/**
 * GET /api/crossref-deposit?articleId=…
 * Returns the latest deposit log + XML preview for an article.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const log = article.crossrefDepositLog
    ? JSON.parse(article.crossrefDepositLog)
    : null;

  // Regenerate XML for preview (read-only)
  const xml = buildDoiBatchXml(article, article.journal, article.issue);

  return NextResponse.json({
    articleId,
    doi: article.doi,
    doiStatus: article.doiStatus,
    batchId: article.crossrefBatchId,
    depositedAt: article.crossrefDepositedAt,
    log,
    xml,
  });
}
