import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { APP_BASE_URL } from "@/lib/site";
import { generateReferralCode } from "@/lib/referrals";

/**
 * GET /api/account/referrals
 * The signed-in user's referral link plus a live count of accounts that
 * signed up through it. Every account created after the referral program
 * shipped gets a `referralCode` at registration; an account that predates
 * it has `referralCode: null` until its first visit here, which backfills
 * one (see the User model's schema comment for why this can't just be a
 * migration-time default).
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let user = await db.user.findUnique({ where: { id: session.userId }, select: { referralCode: true } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (!user.referralCode) {
    user = await db.user.update({
      where: { id: session.userId },
      data: { referralCode: generateReferralCode() },
      select: { referralCode: true },
    });
  }

  const [totalReferred, recentReferrals] = await Promise.all([
    db.user.count({ where: { referredByUserId: session.userId } }),
    db.user.findMany({
      where: { referredByUserId: session.userId },
      select: { id: true, fullName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: `${APP_BASE_URL}/?ref=${user.referralCode}`,
    totalReferred,
    recentReferrals,
  });
}
