import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { depositToCrossref, isLiveMode, buildDoiBatchXml } from "@/lib/crossref";
import { APP_BASE_URL } from "@/lib/site";

/**
 * POST /api/crossref/deposit
 * Body: { articleId }
 *
 * Generates the full <doi_batch> XML for the article and POSTs it to the
 * Crossref test deposit endpoint (api.test.crossref.org). Falls back to
 * simulation mode when CROSSREF_USERNAME/PASSWORD are not set.
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

  const articleUrl = `${APP_BASE_URL}/article/${article.id}`;
  const result = await depositToCrossref({ article, articleUrl });

  // Persist the deposit outcome on the article
  const updated = await db.article.update({
    where: { id: articleId },
    data: {
      crossrefBatchId: result.batchId,
      crossrefDepositedAt: result.depositedAt,
      crossrefDepositLog: JSON.stringify({
        ok: result.ok,
        mode: result.mode,
        status: result.status,
        statusText: result.statusText,
        responseBody: result.responseBody.slice(0, 4000),
        endpoint: result.endpoint,
        batchId: result.batchId,
        depositedAt: result.depositedAt.toISOString(),
      }),
      doiStatus: result.ok ? "PUBLISHED" : article.doiStatus,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "DOI_DEPOSIT",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({
        ok: result.ok,
        mode: result.mode,
        batchId: result.batchId,
        status: result.status,
        endpoint: result.endpoint,
      }),
    },
  });

  // Notify the editor who triggered the deposit
  await db.notification.create({
    data: {
      userId: session.userId,
      type: result.ok ? "SUCCESS" : "ERROR",
      title: result.ok ? "Crossref deposit submitted" : "Crossref deposit failed",
      message:
        (result.ok
          ? `Batch ${result.batchId} submitted to ${result.endpoint} (${result.mode} mode). DOI: ${article.doi}`
          : `Deposit failed: ${result.statusText}. The article DOI remains in its previous state.`),
      articleId,
    },
  });

  return NextResponse.json({
    result,
    article: {
      id: updated.id,
      doi: updated.doi,
      doiStatus: updated.doiStatus,
      crossrefBatchId: updated.crossrefBatchId,
      crossrefDepositedAt: updated.crossrefDepositedAt,
    },
    liveMode: isLiveMode(),
  });
}

/**
 * GET /api/crossref/deposit — returns the live-mode flag so the UI can
 * display whether real Crossref credentials are configured.
 */
export async function GET() {
  return NextResponse.json({ liveMode: isLiveMode() });
}
