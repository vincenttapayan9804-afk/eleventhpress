import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const UpdateTenantSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PROVISIONING"]).optional(),
});

/**
 * TENANT_ADMIN may rename their own tenant but never change `status`
 * (suspend/reactivate is a platform-level moderation action) — enforced by
 * simply stripping that field before it reaches Prisma, rather than
 * trusting the caller not to send it.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, UpdateTenantSchema);
  if (!parsed.ok) return parsed.response;

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const data = { ...parsed.data };
  if (auth.session.role !== "SUPER_ADMIN") delete data.status;

  const updated = await db.tenant.update({ where: { id }, data });
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
