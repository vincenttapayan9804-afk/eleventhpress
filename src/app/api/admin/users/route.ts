import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/admin/users
 * Lists accounts for the admin console's user-management panel.
 * SUPER_ADMIN sees every account platform-wide. TENANT_ADMIN (Whitelabel
 * Phase 4) sees only accounts belonging to their own tenant — never other
 * tenants' users, matching how their session.tenantId scopes every other
 * admin surface (branding, domains).
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN", "TENANT_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const users = await db.user.findMany({
    where: auth.session.role === "TENANT_ADMIN" ? { tenantId: auth.session.tenantId ?? "__none__" } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      affiliation: true,
      country: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}
