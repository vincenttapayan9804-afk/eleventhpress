import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { validateReference } from "@/lib/citations";
import { classifyCitation } from "@/lib/citation-classification";

/**
 * POST /api/articles/[id]/references/validate
 * Editor-only. Runs OpenAlex validation on every PENDING reference for the
 * article (safe to call again — already-checked references are re-checked
 * too, in case a typo was fixed since the last run), then — for every
 * reference that resolves to VALID — a best-effort LLM classification of
 * how this article uses it (supporting/contrasting/mentioning; see
 * src/lib/citation-classification.ts). A reference that doesn't resolve
 * has nothing reliable to classify against, so it's left null rather than
 * guessed from the raw citation text alone.
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
  const [references, article] = await Promise.all([
    db.reference.findMany({ where: { articleId: id } }),
    db.article.findUnique({ where: { id }, select: { title: true, abstract: true } }),
  ]);
  if (!references.length) {
    return NextResponse.json({ references: [] });
  }

  const results = await Promise.all(
    references.map(async (ref) => {
      const validation = await validateReference(ref.rawText);
      let classification: string | null = null;
      if (validation.status === "VALID" && article) {
        const result = await classifyCitation({
          citingTitle: article.title,
          citingAbstract: article.abstract,
          referenceText: ref.rawText,
          resolvedTitle: validation.resolvedTitle,
        });
        classification = result.classification;
      }
      return db.reference.update({
        where: { id: ref.id },
        data: {
          status: validation.status,
          doi: validation.doi ?? null,
          resolvedTitle: validation.resolvedTitle ?? null,
          openAlexId: validation.openAlexId ?? null,
          classification,
          checkedAt: new Date(),
        },
      });
    })
  );

  return NextResponse.json({ references: results });
}
