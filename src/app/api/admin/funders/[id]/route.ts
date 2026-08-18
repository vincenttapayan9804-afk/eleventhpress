import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const UpdateFunderSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  externalId: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  website: z.string().trim().url().max(500).nullable().optional(),
});

/** PATCH/DELETE /api/admin/funders/[id] — tenant-scoped, same posture as /api/admin/departments/[id]. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const funder = await db.funder.findUnique({ where: { id } });
  if (!funder) return NextResponse.json({ error: "Funder not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, funder.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, UpdateFunderSchema);
  if (!parsed.ok) return parsed.response;
  const { name, externalId, country, website } = parsed.data;

  if (name && name !== funder.name) {
    const collision = await db.funder.findUnique({ where: { tenantId_name: { tenantId: funder.tenantId, name } } });
    if (collision) {
      return NextResponse.json({ error: `A funder named "${name}" already exists for this tenant` }, { status: 409 });
    }
  }

  const updated = await db.funder.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(externalId !== undefined && { externalId }),
      ...(country !== undefined && { country }),
      ...(website !== undefined && { website }),
    },
  });

  return NextResponse.json({ funder: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const funder = await db.funder.findUnique({ where: { id } });
  if (!funder) return NextResponse.json({ error: "Funder not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, funder.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const grantCount = await db.grant.count({ where: { funderId: id } });
  if (grantCount > 0) {
    return NextResponse.json(
      { error: "Funder has grants recorded against it and can't be deleted", blockers: { grants: grantCount } },
      { status: 409 }
    );
  }

  await db.funder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
