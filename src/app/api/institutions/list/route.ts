import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/institutions/list
 * Returns all registered institutions (admin only).
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["SUPER_ADMIN", "EDITOR"].includes(session.role)) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const institutions = await db.institution.findMany({
    include: {
      _count: { select: { users: true, datasets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    institutions: institutions.map((i) => ({
      id: i.id,
      name: i.name,
      domain: i.domain,
      country: i.country,
      ipRanges: i.ipRanges,
      plan: i.plan,
      status: i.status,
      currentPeriodEnd: i.currentPeriodEnd,
      apcQuota: i.apcQuota,
      apcUsed: i.apcUsed,
      counterCustomerId: i.counterCustomerId,
      userCount: i._count.users,
      datasetCount: i._count.datasets,
    })),
  });
}
