import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runEditorialTriage } from "@/lib/triage";

/**
 * POST /api/triage
 * Body: { articleId }
 *
 * Runs the LLM-assisted editorial triage on an article and returns the
 * structured report. The report is also persisted in EditorialTriageReport
 * for the editor's dashboard.
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
    select: { id: true, title: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  try {
    const result = await runEditorialTriage(articleId);

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: "TRIAGE_RUN",
        entityType: "ARTICLE",
        entityId: articleId,
        articleId,
        metadata: JSON.stringify({
          mode: result.mode,
          model: result.model,
          scopeFitScore: result.scopeFitScore,
          suggestedReviewers: result.suggestedReviewers.length,
        }),
      },
    });

    return NextResponse.json({ ...result, articleId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * GET /api/triage?articleId=…
 * Returns the stored triage report for an article.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const report = await db.editorialTriageReport.findUnique({
    where: { articleId },
  });
  if (!report) {
    return NextResponse.json({ error: "No triage report found. Run triage first." }, { status: 404 });
  }

  return NextResponse.json({
    articleId: report.articleId,
    scopeFitScore: report.scopeFitScore,
    scopeFitReason: report.scopeFitReason,
    methodologyFlags: JSON.parse(report.methodologyFlags || "[]"),
    suggestedReviewers: JSON.parse(report.suggestedReviewers || "[]"),
    recommendedReviewModel: report.recommendedReviewModel,
    summary: report.summary,
    predictedImpact: report.predictedImpact,
    riskFlags: JSON.parse(report.riskFlags || "[]"),
    model: report.model,
    createdAt: report.createdAt,
  });
}
