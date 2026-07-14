import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/admin/book-jobs
 * Mirrors /api/admin/galley-jobs — lists the most recent BookProductionJob
 * rows for operational visibility. SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const jobs = await db.bookProductionJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const bookIds = Array.from(new Set(jobs.map((j) => j.bookId)));
  const books = await db.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true, title: true },
  });
  const titleById = new Map(books.map((b) => [b.id, b.title]));

  return NextResponse.json({
    jobs: jobs.map((j) => ({ ...j, bookTitle: titleById.get(j.bookId) || null })),
  });
}
