import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const UpdateTenantSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PROVISIONING"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseBody(req, UpdateTenantSchema);
  if (!parsed.ok) return parsed.response;

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const updated = await db.tenant.update({ where: { id }, data: parsed.data });
  return NextResponse.json({
    tenant: { id: updated.id, slug: updated.slug, name: updated.name, status: updated.status, isPlatform: updated.isPlatform },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: { _count: { select: { domains: true, users: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.isPlatform) {
    return NextResponse.json({ error: "Cannot delete the platform tenant" }, { status: 400 });
  }
  if (tenant._count.users > 0) {
    return NextResponse.json({ error: `Tenant has ${tenant._count.users} user(s) — reassign or remove them first` }, { status: 400 });
  }
  if (tenant._count.domains > 0) {
    return NextResponse.json({ error: "Remove all domains from this tenant before deleting it" }, { status: 400 });
  }

  await db.tenant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
