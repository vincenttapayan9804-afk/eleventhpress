import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET/POST /api/admin/departments
 * EP University OS Phase 1 — tenant-scoped org structure, same admin
 * posture as content creation/branding (TENANT_SCOPED_ADMIN_ROLES): a
 * university's own TENANT_ADMIN manages its departments without platform
 * involvement, and SUPER_ADMIN can act across every tenant.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const CreateDepartmentSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(SLUG_RE, "Lowercase letters, numbers, and hyphens only; can't start or end with a hyphen"),
  headUserId: z.string().min(1).optional(),
  parentDepartmentId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const requestedTenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined;
  let tenantId: string | undefined;
  if (session.role === "TENANT_ADMIN") {
    tenantId = session.tenantId ?? undefined;
  } else {
    tenantId = requestedTenantId; // SUPER_ADMIN: omitted = every tenant
  }

  const departments = await withRlsContext(session, (tx) =>
    tx.department.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { members: true, children: true } },
        head: { select: { id: true, fullName: true, email: true } },
      },
    })
  );

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d.id,
      tenantId: d.tenantId,
      name: d.name,
      slug: d.slug,
      headUserId: d.headUserId,
      head: d.head ? { id: d.head.id, fullName: d.head.fullName, email: d.head.email } : null,
      parentDepartmentId: d.parentDepartmentId,
      memberCount: d._count.members,
      childCount: d._count.children,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { session } = auth;

  const parsed = await parseBody(req, CreateDepartmentSchema);
  if (!parsed.ok) return parsed.response;
  const { name, slug, headUserId, parentDepartmentId } = parsed.data;

  let tenantId: string;
  if (session.role === "TENANT_ADMIN") {
    if (parsed.data.tenantId && parsed.data.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Forbidden — not an admin of this tenant" }, { status: 403 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ error: "Your session has no tenant context" }, { status: 400 });
    }
    tenantId = session.tenantId;
  } else {
    if (!parsed.data.tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }
    tenantId = parsed.data.tenantId;
  }

  const tenantScope = requireTenantScope(req.headers, tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!tenantScope.ok) return NextResponse.json({ error: tenantScope.error }, { status: tenantScope.status });

  const existing = await db.department.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
  if (existing) {
    return NextResponse.json({ error: `Slug "${slug}" is already in use for this tenant` }, { status: 409 });
  }

  if (headUserId) {
    const head = await db.user.findUnique({ where: { id: headUserId } });
    if (!head || head.tenantId !== tenantId) {
      return NextResponse.json({ error: "headUserId must belong to this tenant" }, { status: 400 });
    }
  }

  if (parentDepartmentId) {
    const parent = await db.department.findUnique({ where: { id: parentDepartmentId } });
    if (!parent || parent.tenantId !== tenantId) {
      return NextResponse.json({ error: "parentDepartmentId must belong to this tenant" }, { status: 400 });
    }
  }

  const department = await db.department.create({
    data: { tenantId, name, slug, headUserId: headUserId ?? null, parentDepartmentId: parentDepartmentId ?? null },
  });

  return NextResponse.json({ department }, { status: 201 });
}
