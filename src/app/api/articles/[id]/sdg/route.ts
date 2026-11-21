import { NextRequest, NextResponse } from "next/server";
import { canActOnArticle, OTHER_INSTITUTION_ERROR } from "@/lib/tenant-auth";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";
import { parseSdgGoals } from "@/lib/sdg";

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];

/**
 * POST /api/articles/[id]/sdg
 * An editor confirms (or changes) the article's UN Sustainable Development
 * Goals. Body: { goals: number[] }. An empty list is a deliberate "no goal
 * applies" decision, so the article leaves the review list either way.
 * Editor / Associate Editor / Super Admin / Tenant Admin, own journal only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!EDITOR_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id: articleId } = await params;
  if (!(await canActOnArticle(session, articleId))) {
    return NextResponse.json({ error: OTHER_INSTITUTION_ERROR }, { status: 403 });
  }

  let body: { goals?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!Array.isArray(body.goals)) {
    return NextResponse.json({ error: "goals must be a list of goal numbers" }, { status: 400 });
  }
  const goals = parseSdgGoals(body.goals);

  const article = await withRlsContext(session, (tx) =>
    tx.article.findUnique({ where: { id: articleId }, select: { id: true, sdgGoals: true, sdgStatus: true } })
  );
  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  const now = new Date();
  const updated = await db.article.update({
    where: { id: articleId },
    data: {
      sdgGoals: JSON.stringify(goals),
      sdgStatus: "CONFIRMED",
      sdgConfirmedAt: now,
      sdgConfirmedById: session.userId,
    },
    select: { sdgGoals: true, sdgStatus: true, sdgConfirmedAt: true },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "SDG_CONFIRMED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({
        before: { status: article.sdgStatus, goals: parseSdgGoals(article.sdgGoals) },
        after: goals,
      }),
    },
  });

  return NextResponse.json({
    articleId,
    sdgGoals: parseSdgGoals(updated.sdgGoals),
    sdgStatus: updated.sdgStatus,
    sdgConfirmedAt: updated.sdgConfirmedAt,
  });
}
