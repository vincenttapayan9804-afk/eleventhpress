import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { parseBody } from "@/lib/validate";
import { DEVICE_KINDS } from "@/lib/compliance";
import { auditCompliance } from "@/lib/compliance-server";

const Body = z.object({
  label: z.string().trim().min(2).max(120),
  kind: z.enum(DEVICE_KINDS).default("OWNER"),
  notes: z.string().trim().max(1000).optional(),
});

/** POST /api/admin/compliance/devices: adds a device to the inventory (unchecked until the checklist is completed). */
export async function POST(req: NextRequest) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const d = await db.complianceDevice.create({ data: { label: parsed.data.label, kind: parsed.data.kind, notes: parsed.data.notes || null } });
  await auditCompliance(auth.session.userId, "COMPLIANCE_DEVICE_ADDED", d.id, { kind: d.kind });
  return NextResponse.json({ id: d.id }, { status: 201 });
}
