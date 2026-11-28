import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { parseBody } from "@/lib/validate";
import { DEVICE_KINDS, DEFAULT_REVIEW_MONTHS, addMonths, cleanDeviceChecks, deviceFailing } from "@/lib/compliance";
import { auditCompliance } from "@/lib/compliance-server";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    label: z.string().trim().min(2).max(120).optional(),
    kind: z.enum(DEVICE_KINDS).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  }),
  // The owner ticks what is true today. Saving records the date of the check.
  z.object({ action: z.literal("check"), checks: z.record(z.string(), z.boolean()) }),
  z.object({ action: z.literal("retire") }),
]);

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const d = await db.complianceDevice.findUnique({ where: { id } });
  if (!d) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  const uid = auth.session.userId;

  if (data.action === "edit") {
    await db.complianceDevice.update({
      where: { id },
      data: { ...(data.label !== undefined && { label: data.label }), ...(data.kind !== undefined && { kind: data.kind }), ...(data.notes !== undefined && { notes: data.notes || null }) },
    });
    await auditCompliance(uid, "COMPLIANCE_DEVICE_EDITED", id, {});
    return NextResponse.json({ ok: true });
  }
  if (data.action === "check") {
    if (d.retiredAt) return NextResponse.json({ error: "This device is retired." }, { status: 409 });
    const checks = cleanDeviceChecks(data.checks);
    const now = new Date();
    await db.complianceDevice.update({ where: { id }, data: { checks: JSON.stringify(checks), lastCheckedAt: now, nextCheckDue: addMonths(now, DEFAULT_REVIEW_MONTHS) } });
    await auditCompliance(uid, "COMPLIANCE_DEVICE_CHECKED", id, { failing: deviceFailing(checks).length });
    return NextResponse.json({ ok: true, failing: deviceFailing(checks) });
  }
  await db.complianceDevice.update({ where: { id }, data: { retiredAt: new Date() } });
  await auditCompliance(uid, "COMPLIANCE_DEVICE_RETIRED", id, {});
  return NextResponse.json({ ok: true });
}
