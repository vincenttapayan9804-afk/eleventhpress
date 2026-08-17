import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * POST /api/collections/[id]/articles
 * Body: { articleId }
 *
 * Editor-only. Adds one PUBLISHED article to a Collection, appended after
 * the current highest order.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || !EDITOR_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editorial role required" }, { status: 403 });
  }

  const { id } = await params;
  const { articleId } = (await req.json()) as { articleId?: string };
  if (!articleId) {
    return NextResponse.json({ error: "articleId is required" }, { status: 400 });
  }

  const [collection, article, last] = await withRlsContext(session, (tx) =>
    Promise.all([
      tx.collection.findUnique({ where: { id } }),
      tx.article.findUnique({ where: { id: articleId }, select: { id: true, status: true } }),
      tx.collectionArticle.findFirst({ where: { collectionId: id }, orderBy: { order: "desc" } }),
    ])
  );
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Only published articles can be added to a collection" }, { status: 400 });
  }

  await db.collectionArticle.upsert({
    where: { collectionId_articleId: { collectionId: id, articleId } },
    create: { collectionId: id, articleId, order: (last?.order ?? -1) + 1 },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
