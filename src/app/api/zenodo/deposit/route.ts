import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { depositPublishedArticleToZenodo } from "@/lib/zenodo";

/**
 * POST /api/zenodo/deposit
 * Body: { articleId }
 *
 * Manual retry for the Zenodo DOI deposit — used when the automatic deposit
 * at publish time failed (e.g. transient network error, since-fixed metadata
 * issue) and an editor wants to retry without re-running the whole publish
 * pipeline. Editors + Admins only.
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
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const deposit = await depositPublishedArticleToZenodo(articleId);

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "DOI_DEPOSIT",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({
        provider: "ZENODO",
        ok: deposit.ok,
        mode: deposit.mode,
        doi: deposit.doi,
        recordUrl: deposit.recordUrl,
        message: deposit.message,
      }),
    },
  });

  return NextResponse.json(deposit);
}
