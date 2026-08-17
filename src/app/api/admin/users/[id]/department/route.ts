import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const DepartmentChangeSchema = z.object({ departmentId: z.string().min(1).nullable() });

/**
 * POST /api/admin/users/[id]/department
 * EP University OS Phase 1 — admin override for a user's department,
 * mirroring /api/admin/users/[id]/role exactly: SUPER_ADMIN acts on any
 * account, TENANT_ADMIN is confined to accounts in their own tenant. Lets
 * a tenant admin correct/assign a faculty/student's department without
 * waiting on self-service (PATCH /api/auth/me).
 * Body: { departmentId: string | null }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN", "TENANT_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const { id } = await params;
  const parsed = await parseBody(req, DepartmentChangeSchema);
  if (!parsed.ok) return parsed.response;
  const { departmentId } = parsed.data;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (session.role === "TENANT_ADMIN" && target.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Forbidden — that account isn't in your tenant" }, { status: 403 });
  }

  if (departmentId) {
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department || department.tenantId !== target.tenantId) {
      return NextResponse.json({ error: "departmentId must belong to this user's tenant" }, { status: 400 });
    }
  }

  const updated = await db.user.update({ where: { id }, data: { departmentId } });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "DEPARTMENT_CHANGE",
      entityType: "USER",
      entityId: id,
      metadata: JSON.stringify({ from: target.departmentId, to: departmentId, targetEmail: target.email }),
    },
  });

  return NextResponse.json({
    user: { id: updated.id, email: updated.email, fullName: updated.fullName, departmentId: updated.departmentId },
  });
}
