import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * DELETE /api/collections/[id]/articles/[articleId]
 * Editor-only. Removes one article from a Collection.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || !EDITOR_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editorial role required" }, { status: 403 });
  }

  const { id, articleId } = await params;
  await db.collectionArticle
    .delete({ where: { collectionId_articleId: { collectionId: id, articleId } } })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
