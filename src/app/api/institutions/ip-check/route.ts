import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { matchInstitutionByIp, matchInstitutionByDomain } from "@/lib/institutions";

/**
 * GET /api/institutions/ip-check
 *
 * Checks the requester's IP address against all registered institutions.
 * Returns the matched institution (if any) and the access rights it grants.
 *
 * Query params:
 *   - email (optional): if IP doesn't match, try domain matching
 */
export async function GET(req: NextRequest) {
  // Get real IP from headers (behind proxy) or connection
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = forwarded?.split(",")[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1";

  let match = await matchInstitutionByIp(realIp);

  // Fallback: try domain matching if email is provided
  if (!match) {
    const email = new URL(req.url).searchParams.get("email");
    if (email) {
      match = await matchInstitutionByDomain(email);
    }
  }

  return NextResponse.json({
    ip: realIp,
    matched: !!match,
    institution: match,
  });
}

/**
 * POST /api/institutions
 * Creates a new institution (admin only).
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super admin required" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name: string;
    domain?: string;
    country?: string;
    ipRanges: string;
    plan?: string;
    apcQuota?: number;
    counterCustomerId?: string;
  };

  const inst = await db.institution.create({
    data: {
      name: body.name,
      domain: body.domain || null,
      country: body.country || null,
      ipRanges: body.ipRanges,
      plan: body.plan || "INSTITUTIONAL",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      apcQuota: body.apcQuota || 0,
      counterCustomerId: body.counterCustomerId || `epip-${Date.now()}`,
    },
  });

  return NextResponse.json({ institution: inst });
}

/**
 * GET /api/institutions (list all — admin only)
 */
export async function getList() {
  const institutions = await db.institution.findMany({
    include: { _count: { select: { users: true, datasets: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ institutions });
}
