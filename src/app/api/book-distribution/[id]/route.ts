import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { PRIVILEGED_ROLES } from "@/lib/roles";

const ALLOWED_STATUSES = new Set(["SUBMITTED", "LIVE", "FAILED"]);

/**
 * PATCH /api/book-distribution/[id] { status, externalUrl?, notes? }
 * Self-reported completion — there's no webhook to tell us an author
 * actually finished a Draft2Digital/IngramSpark/KDP/Lulu submission, so
 * this just records that they said they did. Same shape as
 * PATCH /api/distribution/[id].
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const row = await db.bookDistribution.findUnique({ where: { id }, include: { book: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPrivileged = PRIVILEGED_ROLES.has(session.role);
  const isAuthor = !!row.book.correspondingAuthorId && session.userId === row.book.correspondingAuthorId;
  if (!isPrivileged && !isAuthor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status, externalUrl, notes } = (await req.json()) as { status?: string; externalUrl?: string; notes?: string };
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: `status must be one of ${[...ALLOWED_STATUSES].join(", ")}` }, { status: 400 });
  }

  const updated = await db.bookDistribution.update({
    where: { id },
    data: {
      status,
      externalUrl: externalUrl ?? row.externalUrl,
      notes: notes ?? row.notes,
      submittedBy: session.userId,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ item: updated });
}
