import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * POST /api/magazine-issues/[id]/pieces
 * { title, dek?, authors (JSON string), category, bodyHtml, heroImageKey?, isCoverStory? }
 * Appends a piece to the end of a DRAFT issue's reader order. Editorial-only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: issueId } = await params;
  const issue = await db.magazineIssue.findUnique({ where: { id: issueId } });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.status !== "DRAFT") {
    return NextResponse.json({ error: "Pieces can only be added while an issue is in DRAFT" }, { status: 400 });
  }

  const body = (await req.json()) as {
    title?: string;
    dek?: string;
    authors?: string;
    category?: string;
    bodyHtml?: string;
    heroImageKey?: string;
    isCoverStory?: boolean;
  };
  if (!body.title || !body.authors || !body.category || !body.bodyHtml) {
    return NextResponse.json({ error: "title, authors, category, and bodyHtml are required" }, { status: 400 });
  }

  const maxOrder = await db.magazinePiece.aggregate({ where: { issueId }, _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  if (body.isCoverStory) {
    await db.magazinePiece.updateMany({ where: { issueId }, data: { isCoverStory: false } });
  }

  const piece = await db.magazinePiece.create({
    data: {
      issueId,
      title: body.title,
      dek: body.dek,
      authors: body.authors,
      category: body.category,
      bodyHtml: body.bodyHtml,
      heroImageKey: body.heroImageKey,
      isCoverStory: !!body.isCoverStory,
      order: nextOrder,
    },
  });

  return NextResponse.json({ piece });
}
