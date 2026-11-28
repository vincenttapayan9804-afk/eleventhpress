import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { parseBody } from "@/lib/validate";
import { RECORD_KINDS, KIND_DEFS, cleanRecordData, isEventKind, canActivate, nextDueFrom, parseRecordData, recordOpenNotes, recordState, summarizeRecords, type RecordKind } from "@/lib/compliance-records";
import { RECORD_SEEDS } from "@/lib/compliance-record-seeds";
import { auditCompliance } from "@/lib/compliance-server";

export const dynamic = "force-dynamic";

/** GET /api/admin/compliance/records: every phase-2 record and the summary. SUPER_ADMIN on the platform site only. */
export async function GET(req: NextRequest) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const now = new Date();
  const rows = await db.complianceRecord.findMany({ orderBy: [{ kind: "asc" }, { createdAt: "desc" }] });
  const have = new Set(
    (await db.auditLog.findMany({ where: { action: "COMPLIANCE_RECORD_SEEDED" }, select: { entityId: true } })).map((a) => a.entityId)
  );
  return NextResponse.json({
    summary: summarizeRecords(rows, now),
    records: rows.map((r) => {
      const data = parseRecordData(r.kind, r.data);
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        status: r.status,
        data,
        isPublic: r.isPublic,
        intervalMonths: r.intervalMonths,
        lastDoneAt: r.lastDoneAt,
        nextDue: r.nextDue,
        state: recordState(r, now),
        openNotes: recordOpenNotes(r.title, data).length,
      };
    }),
    seedsAvailable: RECORD_SEEDS.filter((s) => !have.has(s.seedKey)).length,
  });
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T12:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 86_400_000, "The date cannot be in the future.");

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed") }),
  z.object({
    action: z.literal("create"),
    kind: z.enum(RECORD_KINDS),
    title: z.string().trim().min(3).max(200),
    data: z.record(z.string(), z.unknown()).default({}),
    doneOn: dateOnly.optional(),
  }),
]);

/**
 * POST /api/admin/compliance/records
 *  - { action: "seed" }: loads the starting records that are not yet loaded (never overwrites).
 *  - { action: "create", kind, title, data, doneOn? }: a living record starts as a draft.
 *    A dated event (access review, exercise) is the owner's own entry: it must be complete and
 *    carry the date it happened, and it is saved as active.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const uid = auth.session.userId;

  if (body.action === "seed") {
    const done = new Set((await db.auditLog.findMany({ where: { action: "COMPLIANCE_RECORD_SEEDED" }, select: { entityId: true } })).map((a) => a.entityId));
    const toAdd = RECORD_SEEDS.filter((s) => !done.has(s.seedKey));
    for (const s of toAdd) {
      const data = cleanRecordData(s.kind, s.data);
      const r = await db.complianceRecord.create({
        data: { kind: s.kind, title: s.title, data: JSON.stringify(data), isPublic: !!s.isPublic, intervalMonths: KIND_DEFS[s.kind].intervalMonths },
      });
      await db.auditLog.create({ data: { userId: uid, action: "COMPLIANCE_RECORD_SEEDED", entityType: "COMPLIANCE", entityId: s.seedKey, metadata: JSON.stringify({ recordId: r.id, kind: s.kind }) } });
    }
    return NextResponse.json({ added: toAdd.length });
  }

  const kind = body.kind as RecordKind;
  const data = cleanRecordData(kind, body.data);
  if (isEventKind(kind)) {
    if (!body.doneOn) return NextResponse.json({ error: "Enter the date it was done." }, { status: 400 });
    const ok = canActivate(kind, body.title, data);
    if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: 400 });
    const def = KIND_DEFS[kind];
    const r = await db.complianceRecord.create({
      data: { kind, title: body.title, status: "ACTIVE", data: JSON.stringify(data), intervalMonths: def.intervalMonths, lastDoneAt: body.doneOn, nextDue: nextDueFrom(body.doneOn, def.intervalMonths) },
    });
    await auditCompliance(uid, "COMPLIANCE_RECORD_LOGGED", r.id, { kind });
    return NextResponse.json({ id: r.id }, { status: 201 });
  }
  const r = await db.complianceRecord.create({ data: { kind, title: body.title, data: JSON.stringify(data), intervalMonths: KIND_DEFS[kind].intervalMonths } });
  await auditCompliance(uid, "COMPLIANCE_RECORD_CREATED", r.id, { kind });
  return NextResponse.json({ id: r.id }, { status: 201 });
}
