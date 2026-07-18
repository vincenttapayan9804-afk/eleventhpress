import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { computeAuthorPayout } from "@/lib/royalties";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";
const PLATFORMS = new Set(["DRAFT2DIGITAL", "INGRAMSPARK", "AMAZON_KDP", "LULU", "ALL"]);

/**
 * GET /api/books/[id]/royalties
 * The book's own author, or editorial staff, can view every recorded
 * royalty statement plus running totals. Read-only for authors — statements
 * are staff-entered (see POST below).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id: bookId } = await params;
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPrivileged = PRIVILEGED_ROLES.includes(session.role);
  const isAuthor = !!book.correspondingAuthorId && session.userId === book.correspondingAuthorId;
  if (!isPrivileged && !isAuthor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const statements = await db.royaltyStatement.findMany({
    where: { bookId },
    orderBy: { periodStart: "desc" },
  });

  const totals = statements.reduce(
    (acc, s) => ({
      unitsSold: acc.unitsSold + s.unitsSold,
      grossRevenue: acc.grossRevenue + s.grossRevenue,
      authorPayout: acc.authorPayout + s.authorPayout,
    }),
    { unitsSold: 0, grossRevenue: 0, authorPayout: 0 }
  );

  return NextResponse.json({ statements, totals });
}

/**
 * POST /api/books/[id]/royalties
 * Body: { platform, periodStart, periodEnd, unitsSold, grossRevenue, notes? }
 *
 * Editorial staff only — self-reported, transcribed from each aggregator's
 * own sales dashboard (EPIP has no API access to Draft2Digital/IngramSpark/
 * Amazon KDP/Lulu sales reporting, a much deeper integration than the
 * submission flow built in Phase 4). Snapshots the book's current
 * royaltySharePercent and computes authorPayout at recording time so a
 * later change to the book's terms never rewrites past statements.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!PRIVILEGED_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const { id: bookId } = await params;
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    platform?: string;
    periodStart?: string;
    periodEnd?: string;
    unitsSold?: number;
    grossRevenue?: number;
    notes?: string;
  };

  if (!body.platform || !PLATFORMS.has(body.platform)) {
    return NextResponse.json({ error: `platform must be one of ${[...PLATFORMS].join(", ")}` }, { status: 400 });
  }
  if (!body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }
  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
    return NextResponse.json({ error: "periodStart/periodEnd must be valid dates with periodEnd on or after periodStart" }, { status: 400 });
  }
  const unitsSold = Math.max(0, Math.trunc(body.unitsSold ?? 0));
  const grossRevenue = Math.max(0, Number(body.grossRevenue ?? 0));
  if (!isFinite(grossRevenue)) {
    return NextResponse.json({ error: "grossRevenue must be a finite number" }, { status: 400 });
  }

  const royaltySharePercent = book.royaltySharePercent ?? 70;
  const authorPayout = computeAuthorPayout(grossRevenue, royaltySharePercent);

  const statement = await db.royaltyStatement.create({
    data: {
      bookId,
      platform: body.platform,
      periodStart,
      periodEnd,
      unitsSold,
      grossRevenue,
      royaltySharePercent,
      authorPayout,
      notes: body.notes,
      recordedBy: session.userId,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "ROYALTY_RECORDED",
      entityType: "BOOK",
      entityId: bookId,
      metadata: JSON.stringify({ platform: body.platform, unitsSold, grossRevenue, authorPayout }),
    },
  });

  if (book.correspondingAuthorId) {
    await db.notification.create({
      data: {
        userId: book.correspondingAuthorId,
        type: "INFO",
        title: "Royalty Statement Recorded",
        message: `A royalty statement for "${book.title}" (${body.platform.replace(/_/g, " ")}) was recorded: ${unitsSold} unit(s), USD ${grossRevenue.toFixed(2)} gross, USD ${authorPayout.toFixed(2)} payable to you.`,
      },
    });
  }

  return NextResponse.json({ statement });
}
