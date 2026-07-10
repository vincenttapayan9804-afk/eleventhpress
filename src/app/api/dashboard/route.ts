import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * GET /api/dashboard
 * Returns role-scoped dashboard data.
 *   - AUTHOR: their submissions + APC invoices
 *   - EDITOR / ASSOCIATE_EDITOR: queue of submissions across all states + recent audit
 *   - REVIEWER: assigned reviews
 *   - READER: subscription + recently viewed
 *   - SUPER_ADMIN: everything
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const role = session.role;
  const userId = session.userId;

  // Shared: notifications + counts
  const [notifications, notifCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.notification.count({ where: { userId, read: false } }),
  ]);

  let payload: any = { role, notifications, unreadCount: notifCount };

  if (role === "AUTHOR" || role === "SUPER_ADMIN") {
    const submissions = await db.article.findMany({
      where: { correspondingAuthorId: userId },
      orderBy: { createdAt: "desc" },
      include: { issue: true, reviews: true },
    });
    const invoices = await db.invoice.findMany({
      where: { userId },
      include: { article: { select: { title: true, doi: true } } },
      orderBy: { createdAt: "desc" },
    });
    payload.submissions = submissions;
    payload.invoices = invoices;
  }

  if (["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(role)) {
    const queue = await db.article.findMany({
      where: {
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUIRED", "ACCEPTED", "IN_PRODUCTION"] },
      },
      orderBy: { submittedAt: "desc" },
      include: {
        author: { select: { fullName: true, email: true, affiliation: true } },
        reviews: {
          include: {
            reviewer: { select: { fullName: true, affiliation: true } },
          },
        },
      },
    });
    const published = await db.article.count({ where: { status: "PUBLISHED" } });
    const inReview = await db.article.count({ where: { status: "UNDER_REVIEW" } });
    const accepted = await db.article.count({ where: { status: "ACCEPTED" } });
    const submitted = await db.article.count({ where: { status: "SUBMITTED" } });

    const recentAudit = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { fullName: true, role: true } } },
    });

    payload.queue = queue;
    payload.stats = { published, inReview, accepted, submitted };
    payload.recentAudit = recentAudit;
  }

  if (role === "REVIEWER" || role === "SUPER_ADMIN") {
    const reviews = await db.review.findMany({
      where: { reviewerId: userId },
      include: { article: { include: { issue: true } } },
      orderBy: { createdAt: "desc" },
    });
    payload.reviews = reviews;
  }

  if (role === "READER" || role === "AUTHOR" || role === "REVIEWER" || role === "SUPER_ADMIN") {
    const subscription = await db.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    payload.subscription = subscription;
  }

  return NextResponse.json(payload);
}
