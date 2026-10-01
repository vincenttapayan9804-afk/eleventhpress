import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { APP_BASE_URL } from "@/lib/site";

/**
 * GET /api/account/referrals
 * The signed-in user's referral link plus a live count of accounts that
 * signed up through it. Every account already has a `referralCode` (set
 * once, at creation — see the User model), so this never needs to
 * generate one on first use.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const [user, totalReferred, recentReferrals] = await Promise.all([
    db.user.findUnique({ where: { id: session.userId }, select: { referralCode: true } }),
    db.user.count({ where: { referredByUserId: session.userId } }),
    db.user.findMany({
      where: { referredByUserId: session.userId },
      select: { id: true, fullName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: `${APP_BASE_URL}/?ref=${user.referralCode}`,
    totalReferred,
    recentReferrals,
  });
}
