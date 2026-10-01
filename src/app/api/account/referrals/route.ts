import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { APP_BASE_URL } from "@/lib/site";
import { generateReferralCode, highestReferralMilestone } from "@/lib/referrals";

/**
 * GET /api/account/referrals
 * The signed-in user's referral link, a live count of accounts that
 * signed up through it, their highest milestone badge, platform rank, and
 * a top-5 leaderboard — same public-names posture the Authors directory
 * already uses elsewhere on this platform. Every account created after
 * the referral program shipped gets a `referralCode` at registration; an
 * account that predates it has `referralCode: null` until its first visit
 * here, which backfills one (see the User model's schema comment for why
 * this can't just be a migration-time default).
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

  const [totalReferred, recentReferrals, grouped] = await Promise.all([
    db.user.count({ where: { referredByUserId: session.userId } }),
    db.user.findMany({
      where: { referredByUserId: session.userId },
      select: { id: true, fullName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.user.groupBy({
      by: ["referredByUserId"],
      where: { referredByUserId: { not: null } },
      _count: { referredByUserId: true },
    }),
  ]);

  const ranked = grouped
    .map((g) => ({ userId: g.referredByUserId as string, count: g._count.referredByUserId }))
    .sort((a, b) => b.count - a.count);
  const rank = totalReferred > 0 ? ranked.findIndex((r) => r.userId === session.userId) + 1 : null;

  const topIds = ranked.slice(0, 5).map((r) => r.userId);
  const topUsers = topIds.length
    ? await db.user.findMany({ where: { id: { in: topIds } }, select: { id: true, fullName: true } })
    : [];
  const topUsersById = new Map(topUsers.map((u) => [u.id, u.fullName]));
  const leaderboard = ranked.slice(0, 5).map((r) => ({
    fullName: topUsersById.get(r.userId) || "A referrer",
    totalReferred: r.count,
  }));

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: `${APP_BASE_URL}/?ref=${user.referralCode}`,
    totalReferred,
    recentReferrals,
    milestone: highestReferralMilestone(totalReferred),
    rank,
    leaderboard,
  });
}
