import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];
const MAX_DRAFT_CHARS = 40_000;

/**
 * PATCH /api/research-lab/prisma-draft/[id]
 * Lets the researcher who drafted a systematic-review scaffold revise the
 * full markdown draft in place — same "first draft to revise" contract as
 * the tool's own generation prompt states, now backed by a real save
 * path instead of copy-paste-into-another-editor being the only option.
 * The pristine AI output is preserved (once) in originalResultJson.
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
  if (!doc || doc.userId !== session.userId || doc.kind !== "PRISMA_DRAFT") {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { draft?: string };
  if (typeof body.draft !== "string" || !body.draft.trim()) {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }
  const draft = body.draft.slice(0, MAX_DRAFT_CHARS);

  const current = JSON.parse(doc.resultJson);
  const updated = { ...current, draft };

  const saved = await db.researchLabDocument.update({
    where: { id },
    data: {
      resultJson: JSON.stringify(updated),
      originalResultJson: doc.originalResultJson ?? doc.resultJson,
      editedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "RESEARCH_LAB_DOCUMENT_EDITED",
      entityType: "RESEARCH_LAB_DOCUMENT",
      entityId: id,
      metadata: JSON.stringify({ kind: "PRISMA_DRAFT" }),
    },
  });

  return NextResponse.json({ ...saved, result: JSON.parse(saved.resultJson) });
}
