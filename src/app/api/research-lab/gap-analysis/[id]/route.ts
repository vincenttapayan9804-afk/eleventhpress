import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];
const MAX_OVERVIEW_CHARS = 4000;
const MAX_GAPS = 30;
const MAX_GAP_CHARS = 500;
const MAX_EXPLANATION_CHARS = 2000;

/**
 * PATCH /api/research-lab/gap-analysis/[id]
 * Lets the researcher who ran a Gap Finder analysis revise its overview
 * and/or gap list in place — an AI-drafted analysis is a starting point,
 * not a finished artifact, and the researcher's own edits are exactly the
 * kind of correction the "AI suggests, human decides" contract expects.
 * The pristine AI output is preserved (once) in originalResultJson so
 * "view original" never depends on a second LLM call.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await db.researchLabDocument.findUnique({ where: { id } });
  if (!doc || doc.userId !== session.userId || doc.kind !== "GAP_ANALYSIS") {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    overview?: string;
    gaps?: { gap: string; explanation: string }[];
  };
  const overview = typeof body.overview === "string" ? body.overview.slice(0, MAX_OVERVIEW_CHARS) : undefined;
  const gaps = Array.isArray(body.gaps)
    ? body.gaps
        .filter((g): g is { gap: string; explanation: string } => !!g && typeof g.gap === "string")
        .map((g) => ({
          gap: g.gap.slice(0, MAX_GAP_CHARS),
          explanation: typeof g.explanation === "string" ? g.explanation.slice(0, MAX_EXPLANATION_CHARS) : "",
        }))
        .slice(0, MAX_GAPS)
    : undefined;
  if (overview === undefined && gaps === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const current = JSON.parse(doc.resultJson);
  const updated = {
    ...current,
    ...(overview !== undefined ? { overview } : {}),
    ...(gaps !== undefined ? { gaps } : {}),
  };

  const saved = await db.researchLabDocument.update({
    where: { id },
    data: {
      resultJson: JSON.stringify(updated),
      originalResultJson: doc.originalResultJson ?? doc.resultJson,
      editedAt: new Date(),
    },
  });

  return NextResponse.json({ ...saved, result: JSON.parse(saved.resultJson) });
}
