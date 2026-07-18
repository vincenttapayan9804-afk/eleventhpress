import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runBookProductionJob } from "@/lib/book-production";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

const ACTIONS: Record<string, { from: string[]; to: string }> = {
  SEND_TO_REVIEW: { from: ["SUBMITTED"], to: "UNDER_REVIEW" },
  ACCEPT: { from: ["UNDER_REVIEW"], to: "ACCEPTED" },
  REJECT: { from: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED"], to: "REJECTED" },
  SEND_TO_PRODUCTION: { from: ["ACCEPTED"], to: "IN_PRODUCTION" },
  PUBLISH: { from: ["IN_PRODUCTION"], to: "PUBLISHED" },
};

/**
 * POST /api/books/[id]/workflow { action }
 * Editorial staff only. SEND_TO_PRODUCTION synchronously runs the EPUB/PDF
 * production job (src/lib/book-production.ts) before returning, same
 * pattern as /api/galley/generate — the job row still exists independently
 * so a crash mid-run is recoverable via the same durable-queue mechanism,
 * this just doesn't make the caller poll for the common case.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!PRIVILEGED_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };
  const transition = action ? ACTIONS[action] : undefined;
  if (!transition) {
    return NextResponse.json({ error: `action must be one of ${Object.keys(ACTIONS).join(", ")}` }, { status: 400 });
  }

  const book = await db.book.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!transition.from.includes(book.status)) {
    return NextResponse.json({ error: `Cannot ${action} a book in status ${book.status}` }, { status: 400 });
  }

  if (action === "PUBLISH" && (!book.epubKey || !book.pdfKey)) {
    return NextResponse.json({ error: "Production must complete (EPUB and PDF present) before publishing" }, { status: 400 });
  }

  const updated = await db.book.update({
    where: { id },
    data: {
      status: transition.to,
      acceptedAt: action === "ACCEPT" ? new Date() : book.acceptedAt,
      publishedAt: action === "PUBLISH" ? new Date() : book.publishedAt,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: `BOOK_${action}`,
      entityType: "BOOK",
      entityId: book.id,
      metadata: JSON.stringify({ from: book.status, to: transition.to }),
    },
  });

  if (action === "SEND_TO_PRODUCTION") {
    const job = await db.bookProductionJob.create({
      data: { bookId: book.id, status: "QUEUED" },
    });
    await runBookProductionJob(job.id, session.userId, { status: "QUEUED" });
    const finished = await db.bookProductionJob.findUnique({ where: { id: job.id } });
    return NextResponse.json({
      book: await db.book.findUnique({ where: { id } }),
      productionJob: finished,
    });
  }

  return NextResponse.json({ book: updated });
}
