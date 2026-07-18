import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { DIRECTORIES, DIRECTORY_STATUSES, type Directory, type DirectoryStatus } from "@/lib/directory-listings";

/**
 * GET /api/admin/directory-listings
 * Returns every DirectoryListing row, plus a row for each directory that
 * has no listing yet (defaulted to NOT_APPLIED), so the dashboard always
 * shows all five directories. SUPER_ADMIN only, mirroring
 * /api/admin/preservation — a listing-status claim is exactly the kind of
 * thing this codebase's honesty convention treats as high-stakes.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const journal = await db.journal.findFirst();
  if (!journal) {
    return NextResponse.json({ listings: [] });
  }

  const existing = await db.directoryListing.findMany({ where: { journalId: journal.id } });
  const byDirectory = new Map(existing.map((d) => [d.directory, d]));

  const listings = DIRECTORIES.map(
    (directory) =>
      byDirectory.get(directory) ?? {
        id: null,
        journalId: journal.id,
        directory,
        status: "NOT_APPLIED",
        appliedAt: null,
        listingUrl: null,
        notes: null,
        updatedBy: null,
      }
  );

  return NextResponse.json({ journal: { id: journal.id, name: journal.name }, listings });
}

/**
 * PATCH /api/admin/directory-listings
 * Body: { journalId, directory, status, listingUrl?, notes? }
 * Upserts the listing row for a (journal, directory) pair. SUPER_ADMIN only.
 */
export async function PATCH(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { session } = auth;

  const body = (await req.json()) as {
    journalId: string;
    directory: Directory;
    status: DirectoryStatus;
    listingUrl?: string | null;
    notes?: string | null;
  };

  if (!DIRECTORIES.includes(body.directory)) {
    return NextResponse.json({ error: `directory must be one of ${DIRECTORIES.join(", ")}` }, { status: 400 });
  }
  if (!DIRECTORY_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${DIRECTORY_STATUSES.join(", ")}` }, { status: 400 });
  }

  const journal = await db.journal.findUnique({ where: { id: body.journalId } });
  if (!journal) {
    return NextResponse.json({ error: "Journal not found" }, { status: 404 });
  }

  const listing = await db.directoryListing.upsert({
    where: { journalId_directory: { journalId: body.journalId, directory: body.directory } },
    create: {
      journalId: body.journalId,
      directory: body.directory,
      status: body.status,
      listingUrl: body.listingUrl ?? null,
      notes: body.notes ?? null,
      updatedBy: session.userId,
      appliedAt: body.status !== "NOT_APPLIED" ? new Date() : null,
    },
    update: {
      status: body.status,
      listingUrl: body.listingUrl ?? null,
      notes: body.notes ?? null,
      updatedBy: session.userId,
      ...(body.status !== "NOT_APPLIED" ? {} : { appliedAt: null }),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "DIRECTORY_LISTING_STATUS_UPDATED",
      entityType: "JOURNAL",
      entityId: body.journalId,
      metadata: JSON.stringify({ directory: body.directory, status: body.status }),
    },
  });

  return NextResponse.json({ listing });
}
