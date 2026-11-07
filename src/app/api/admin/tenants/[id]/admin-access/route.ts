import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { issueTemporaryPassword, sendTenantAdminCredentials, tenantLinks } from "@/lib/tenant-onboarding";

const Schema = z.object({ userId: z.string().min(1).optional() });

/**
 * POST /api/admin/tenants/[id]/admin-access { userId? }
 * SUPER_ADMIN only. Issues the tenant's administrator a new temporary
 * password and emails the sign-in details again — for a lost welcome email
 * or a forgotten password. The admin must choose a new password at sign-in.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const parsed = await parseBody(req, Schema);
  if (!parsed.ok) return parsed.response;

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.isPlatform) return NextResponse.json({ error: "Not available for the platform tenant" }, { status: 400 });

  const admin = await db.user.findFirst({
    where: {
      tenantId: id,
      role: "TENANT_ADMIN",
      deletedAt: null,
      ...(parsed.data.userId ? { id: parsed.data.userId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, fullName: true },
  });
  if (!admin) return NextResponse.json({ error: "This tenant has no administrator account yet" }, { status: 404 });

  const temporaryPassword = await issueTemporaryPassword(admin.id);
  const delivery = await sendTenantAdminCredentials({
    to: admin.email,
    adminName: admin.fullName,
    tenantName: tenant.siteName || tenant.name,
    tenantSlug: tenant.slug,
    temporaryPassword,
    isReset: true,
  });

  await db.auditLog
    .create({
      data: {
        userId: auth.session.userId,
        action: "TENANT_ADMIN_CREDENTIALS_REISSUED",
        entityType: "USER",
        entityId: admin.id,
        metadata: JSON.stringify({ tenantId: id, emailDelivered: delivery.delivered }),
      },
    })
    .catch(() => {});

  return NextResponse.json({
    admin: { id: admin.id, email: admin.email, fullName: admin.fullName, temporaryPassword },
    ...tenantLinks(tenant.slug),
    emailDelivered: delivery.delivered,
    emailMode: delivery.mode,
  });
}
