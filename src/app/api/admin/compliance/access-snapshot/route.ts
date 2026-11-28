import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/tenant-auth";
import { ELEVATED_ROLES } from "@/lib/compliance-records";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/compliance/access-snapshot
 * Everyone who holds an administrator or editor role right now, so the owner
 * can do the yearly access review against the real list.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePlatformSuperAdmin(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const users = await db.user.findMany({
    where: { role: { in: [...ELEVATED_ROLES] } },
    select: { fullName: true, email: true, role: true, tenantId: true, twoFactorEnabled: true },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    take: 500,
  });
  return NextResponse.json({
    accounts: users.map((u) => ({ name: u.fullName, email: u.email, role: u.role, scope: u.tenantId ? "a partner portal" : "the platform", twoStep: u.twoFactorEnabled })),
  });
}
