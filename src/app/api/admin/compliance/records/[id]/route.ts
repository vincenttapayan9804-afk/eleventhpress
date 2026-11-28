import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { parseBody } from "@/lib/validate";
import { KIND_DEFS, canActivate, cleanRecordData, isEventKind, nextDueFrom, parseRecordData, recordOpenNotes, type RecordKind } from "@/lib/compliance-records";
import { auditCompliance } from "@/lib/compliance-server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const pastDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T12:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 86_400_000, "The date cannot be in the future.");

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    title: z.string().trim().min(3).max(200).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    isPublic: z.boolean().optional(),
    intervalMonths: z.number().int().min(1).max(36).optional(),
  }),
  z.object({ action: z.literal("activate"), doneOn: pastDate.optional() }),
  z.object({ action: z.literal("done"), doneOn: pastDate.optional() }),
  z.object({ action: z.literal("retire") }),
  z.object({ action: z.literal("reopen") }),
]);

/**
 * PATCH /api/admin/compliance/records/[id]
 * Confirming (activate) and recording a review or rotation (done) are the
 * owner's acts. Neither can be done while a [CONFIRM: …] note remains or a
 * required field is empty.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const r = await db.complianceRecord.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  const uid = auth.session.userId;
  const kind = r.kind as RecordKind;
  const def = KIND_DEFS[kind];

  if (body.action === "save") {
    if (r.status === "RETIRED") return NextResponse.json({ error: "Reopen it before editing." }, { status: 409 });
    if (isEventKind(kind) && r.status === "ACTIVE") return NextResponse.json({ error: "A logged entry is a record of what happened and is not edited. Log a new one instead." }, { status: 409 });
    const data = body.data ? cleanRecordData(kind, body.data) : parseRecordData(kind, r.data);
    const title = body.title ?? r.title;
    // Changing an active record's content sends it back to a draft: the owner must confirm the new wording.
    const contentChanged = body.data !== undefined || title !== r.title;
    await db.complianceRecord.update({
      where: { id },
      data: {
        title,
        data: JSON.stringify(data),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
        ...(body.intervalMonths !== undefined ? { intervalMonths: body.intervalMonths, ...(r.lastDoneAt ? { nextDue: nextDueFrom(r.lastDoneAt, body.intervalMonths) } : {}) } : {}),
        ...(contentChanged && r.status === "ACTIVE" ? { status: "DRAFT" } : {}),
      },
    });
    await auditCompliance(uid, "COMPLIANCE_RECORD_SAVED", id, { kind, backToDraft: contentChanged && r.status === "ACTIVE" });
    return NextResponse.json({ ok: true, backToDraft: contentChanged && r.status === "ACTIVE" });
  }

  if (body.action === "activate") {
    if (r.status !== "DRAFT") return NextResponse.json({ error: "Only a draft can be confirmed." }, { status: 409 });
    const ok = canActivate(kind, r.title, parseRecordData(kind, r.data));
    if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: 400 });
    const on = body.doneOn ?? new Date();
    await db.complianceRecord.update({ where: { id }, data: { status: "ACTIVE", lastDoneAt: on, nextDue: nextDueFrom(on, r.intervalMonths) } });
    await auditCompliance(uid, "COMPLIANCE_RECORD_CONFIRMED", id, { kind });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "done") {
    if (r.status !== "ACTIVE") return NextResponse.json({ error: "Confirm it first." }, { status: 409 });
    if (isEventKind(kind)) return NextResponse.json({ error: "Log a new entry instead." }, { status: 409 });
    const openNotes = recordOpenNotes(r.title, parseRecordData(kind, r.data));
    if (openNotes.length) return NextResponse.json({ error: "Answer the open notes first." }, { status: 400 });
    const on = body.doneOn ?? new Date();
    await db.complianceRecord.update({ where: { id }, data: { lastDoneAt: on, nextDue: nextDueFrom(on, r.intervalMonths) } });
    await auditCompliance(uid, "COMPLIANCE_RECORD_DONE", id, { kind, action: def.doneLabel });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "retire") {
    await db.complianceRecord.update({ where: { id }, data: { status: "RETIRED", nextDue: null, isPublic: false } });
    await auditCompliance(uid, "COMPLIANCE_RECORD_RETIRED", id, { kind });
    return NextResponse.json({ ok: true });
  }

  if (r.status !== "RETIRED") return NextResponse.json({ error: "Only a retired record can be reopened." }, { status: 409 });
  await db.complianceRecord.update({ where: { id }, data: { status: "DRAFT", lastDoneAt: null, nextDue: null } });
  await auditCompliance(uid, "COMPLIANCE_RECORD_REOPENED", id, { kind });
  return NextResponse.json({ ok: true });
}

/** DELETE: only a draft that was never confirmed. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const r = await db.complianceRecord.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  if (r.status !== "DRAFT" || r.lastDoneAt) return NextResponse.json({ error: "Only a draft that was never confirmed can be deleted. Retire it instead." }, { status: 409 });
  await db.complianceRecord.delete({ where: { id } });
  await auditCompliance(auth.session.userId, "COMPLIANCE_RECORD_DELETED", id, { kind: r.kind });
  return NextResponse.json({ ok: true });
}
