import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { PRESERVATION_PROVIDERS, PRESERVATION_STATUSES, type PreservationProvider, type PreservationStatus } from "@/lib/preservation";

/**
 * GET /api/admin/preservation
 * Returns every PreservationDeposit row (one journal today, but the shape
 * supports more), plus a row for each provider that has no deposit yet
 * (defaulted to NOT_STARTED client-side isn't needed — this route fills
 * in the gaps so the dashboard always shows both CLOCKSS and Portico).
 * SUPER_ADMIN only — a preservation-status claim is exactly the kind of
 * thing this codebase's honesty convention treats as high-stakes.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const journal = await db.journal.findFirst();
  if (!journal) {
    return NextResponse.json({ deposits: [] });
  }

  const existing = await db.preservationDeposit.findMany({ where: { journalId: journal.id } });
  const byProvider = new Map(existing.map((d) => [d.provider, d]));

  const deposits = PRESERVATION_PROVIDERS.map(
    (provider) =>
      byProvider.get(provider) ?? {
        id: null,
        journalId: journal.id,
        provider,
        status: "NOT_STARTED",
        agreementRef: null,
        coverageFrom: null,
        lastConfirmedAt: null,
        notes: null,
        updatedBy: null,
      }
  );

  return NextResponse.json({ journal: { id: journal.id, name: journal.name }, deposits });
}

/**
 * PATCH /api/admin/preservation
 * Body: { journalId, provider, status, agreementRef?, notes? }
 * Upserts the deposit row for a (journal, provider) pair. SUPER_ADMIN only.
 */
export async function PATCH(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = (await req.json()) as {
    journalId: string;
    provider: PreservationProvider;
    status: PreservationStatus;
    agreementRef?: string | null;
    notes?: string | null;
  };

  if (!PRESERVATION_PROVIDERS.includes(body.provider)) {
    return NextResponse.json({ error: `provider must be one of ${PRESERVATION_PROVIDERS.join(", ")}` }, { status: 400 });
  }
  if (!PRESERVATION_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${PRESERVATION_STATUSES.join(", ")}` }, { status: 400 });
  }

  const journal = await db.journal.findUnique({ where: { id: body.journalId } });
  if (!journal) {
    return NextResponse.json({ error: "Journal not found" }, { status: 404 });
  }

  const deposit = await db.preservationDeposit.upsert({
    where: { journalId_provider: { journalId: body.journalId, provider: body.provider } },
    create: {
      journalId: body.journalId,
      provider: body.provider,
      status: body.status,
      agreementRef: body.agreementRef ?? null,
      notes: body.notes ?? null,
      updatedBy: session.userId,
      lastConfirmedAt: body.status === "CONFIRMED_ARCHIVED" ? new Date() : null,
    },
    update: {
      status: body.status,
      agreementRef: body.agreementRef ?? null,
      notes: body.notes ?? null,
      updatedBy: session.userId,
      ...(body.status === "CONFIRMED_ARCHIVED" ? { lastConfirmedAt: new Date() } : {}),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "PRESERVATION_STATUS_UPDATED",
      entityType: "JOURNAL",
      entityId: body.journalId,
      metadata: JSON.stringify({ provider: body.provider, status: body.status }),
    },
  });

  return NextResponse.json({ deposit });
}
