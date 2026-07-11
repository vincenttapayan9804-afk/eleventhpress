import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { validateReference } from "@/lib/citations";

/**
 * POST /api/articles/[id]/references/validate
 * Editor-only. Runs OpenAlex validation on every PENDING reference for the
 * article (safe to call again — already-checked references are re-checked
 * too, in case a typo was fixed since the last run).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || !["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id } = await params;
  const references = await db.reference.findMany({ where: { articleId: id } });
  if (!references.length) {
    return NextResponse.json({ references: [] });
  }

  const results = await Promise.all(
    references.map(async (ref) => {
      const validation = await validateReference(ref.rawText);
      return db.reference.update({
        where: { id: ref.id },
        data: {
          status: validation.status,
          doi: validation.doi ?? null,
          resolvedTitle: validation.resolvedTitle ?? null,
          openAlexId: validation.openAlexId ?? null,
          checkedAt: new Date(),
        },
      });
    })
  );

  return NextResponse.json({ references: results });
}
