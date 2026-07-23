import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { runMagazineIssueProductionJob } from "@/lib/magazine-production";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

const ACTIONS: Record<string, { from: string[]; to: string }> = {
  SEND_TO_PRODUCTION: { from: ["DRAFT"], to: "IN_PRODUCTION" },
  PUBLISH: { from: ["IN_PRODUCTION"], to: "PUBLISHED" },
};

/**
 * POST /api/magazine-issues/[id]/workflow { action }
 * Editorial staff only. SEND_TO_PRODUCTION synchronously runs the EPUB/PDF
 * compile job (src/lib/magazine-production.ts) before returning — same
 * pattern as /api/books/[id]/workflow — the job row still exists
 * independently so a crash mid-run is recoverable via the durable-queue
 * cron sweep.
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

  const issue = await db.magazineIssue.findUnique({ where: { id } });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!transition.from.includes(issue.status)) {
    return NextResponse.json({ error: `Cannot ${action} an issue in status ${issue.status}` }, { status: 400 });
  }

  if (action === "SEND_TO_PRODUCTION") {
    const pieceCount = await db.magazinePiece.count({ where: { issueId: id } });
    if (pieceCount === 0) {
      return NextResponse.json({ error: "Add at least one piece before sending an issue to production" }, { status: 400 });
    }
  }
  if (action === "PUBLISH" && (!issue.epubKey || !issue.pdfKey)) {
    return NextResponse.json({ error: "Production must complete (EPUB and PDF present) before publishing" }, { status: 400 });
  }

  const updated = await db.magazineIssue.update({
    where: { id },
    data: {
      status: transition.to,
      publishedAt: action === "PUBLISH" ? new Date() : issue.publishedAt,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: `MAGAZINE_ISSUE_${action}`,
      entityType: "MAGAZINE_ISSUE",
      entityId: issue.id,
      metadata: JSON.stringify({ from: issue.status, to: transition.to }),
    },
  });

  if (action === "SEND_TO_PRODUCTION") {
    const job = await db.magazineIssueProductionJob.create({
      data: { issueId: issue.id, status: "QUEUED" },
    });
    await runMagazineIssueProductionJob(job.id, session.userId, { status: "QUEUED" });
    const finished = await db.magazineIssueProductionJob.findUnique({ where: { id: job.id } });
    return NextResponse.json({
      issue: await db.magazineIssue.findUnique({ where: { id } }),
      productionJob: finished,
    });
  }

  return NextResponse.json({ issue: updated });
}
