import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UpdateDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().toLowerCase().min(2).max(63).regex(SLUG_RE).optional(),
  headUserId: z.string().min(1).nullable().optional(),
  parentDepartmentId: z.string().min(1).nullable().optional(),
});

/** PATCH/DELETE /api/admin/departments/[id] — tenant-scoped, same posture as /api/admin/departments POST. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const department = await db.department.findUnique({ where: { id } });
  if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, department.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, UpdateDepartmentSchema);
  if (!parsed.ok) return parsed.response;
  const { name, slug, headUserId, parentDepartmentId } = parsed.data;

  if (slug && slug !== department.slug) {
    const collision = await db.department.findUnique({ where: { tenantId_slug: { tenantId: department.tenantId, slug } } });
    if (collision) {
      return NextResponse.json({ error: `Slug "${slug}" is already in use for this tenant` }, { status: 409 });
    }
  }

  if (headUserId) {
    const head = await db.user.findUnique({ where: { id: headUserId } });
    if (!head || head.tenantId !== department.tenantId) {
      return NextResponse.json({ error: "headUserId must belong to this tenant" }, { status: 400 });
    }
  }

  if (parentDepartmentId) {
    if (parentDepartmentId === id) {
      return NextResponse.json({ error: "A department can't be its own parent" }, { status: 400 });
    }
    const parent = await db.department.findUnique({ where: { id: parentDepartmentId } });
    if (!parent || parent.tenantId !== department.tenantId) {
      return NextResponse.json({ error: "parentDepartmentId must belong to this tenant" }, { status: 400 });
    }
  }

  const updated = await db.department.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(headUserId !== undefined && { headUserId }),
      ...(parentDepartmentId !== undefined && { parentDepartmentId }),
    },
  });

  return NextResponse.json({ department: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const department = await db.department.findUnique({ where: { id } });
  if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

  const auth = requireTenantScope(req.headers, department.tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [memberCount, childCount] = await Promise.all([
    db.user.count({ where: { departmentId: id } }),
    db.department.count({ where: { parentDepartmentId: id } }),
  ]);

  if (memberCount > 0 || childCount > 0) {
    return NextResponse.json(
      {
        error: "Department has members or sub-departments and can't be deleted",
        blockers: { members: memberCount, childDepartments: childCount },
      },
      { status: 409 }
    );
  }

  await db.department.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
