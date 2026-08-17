import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";

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

  if (role === "AUTHOR" || role === "EXPERT" || role === "SUPER_ADMIN") {
    const [submissions, invoices] = await withRlsContext(session, (tx) =>
      Promise.all([
        tx.article.findMany({
          where: { correspondingAuthorId: userId },
          orderBy: { createdAt: "desc" },
          include: { issue: true, reviews: true },
        }),
        tx.invoice.findMany({
          where: { userId },
          include: { article: { select: { title: true, doi: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ])
    );
    payload.submissions = submissions;
    payload.invoices = invoices;
  }

  if (["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(role)) {
    // Whitelabel Phase 7 — a tenant's editorial board only sees that
    // tenant's own queue, stats, and audit trail. SUPER_ADMIN keeps the
    // platform-wide view (role === "SUPER_ADMIN" below, unfiltered) — same
    // "session.tenantId null means no tenant context, allow through"
    // fail-open posture as isSameEditorialTenant (src/lib/tenant-auth.ts).
    // Whitelabel Phase 8 — every read here now runs inside withRlsContext
    // (previously only invoices/recentAudit did), so this route is fully
    // covered once RLS activation flips the runtime DB role.
    const tenantFilter =
      role === "SUPER_ADMIN" || !session.tenantId ? {} : { journal: { tenantId: session.tenantId } };
    const auditFilter = role === "SUPER_ADMIN" || !session.tenantId ? {} : { tenantId: session.tenantId };

    const [queue, published, inReview, accepted, submitted, recentAudit] = await withRlsContext(session, (tx) =>
      Promise.all([
        tx.article.findMany({
          where: {
            status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUIRED", "ACCEPTED", "IN_PRODUCTION", "PUBLISHED"] },
            ...tenantFilter,
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
        }),
        tx.article.count({ where: { status: "PUBLISHED", ...tenantFilter } }),
        tx.article.count({ where: { status: "UNDER_REVIEW", ...tenantFilter } }),
        tx.article.count({ where: { status: "ACCEPTED", ...tenantFilter } }),
        tx.article.count({ where: { status: "SUBMITTED", ...tenantFilter } }),
        tx.auditLog.findMany({
          where: auditFilter,
          orderBy: { createdAt: "desc" },
          take: 15,
          include: { user: { select: { fullName: true, role: true } } },
        }),
      ])
    );

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
