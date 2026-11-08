import { db } from "@/lib/db";
import { notify, notifyMany } from "@/lib/notify";
import { editorsForReview } from "@/lib/review-editors";

const DAY = 24 * 3600 * 1000;

/**
 * Daily review reminders (run from /api/cron/sweep-all). Each goes out at
 * most once per review, tracked on the Review row:
 * - an invitation with no answer after 3 days: a nudge to the reviewer;
 * - an accepted review due within 3 days: a reminder to the reviewer;
 * - an overdue review: a reminder to the reviewer and a heads-up to the editor.
 */
export async function sendReviewReminders(now = new Date()): Promise<{ nudged: number; dueSoon: number; overdue: number }> {
  const include = { article: { select: { title: true } } } as const;

  const unanswered = await db.review.findMany({
    // Only recent invitations: one that's been ignored for a month isn't nudged.
    where: {
      status: "INVITED",
      invitationNudgedAt: null,
      createdAt: { lte: new Date(now.getTime() - 3 * DAY), gte: new Date(now.getTime() - 30 * DAY) },
    },
    include,
    take: 200,
  });
  for (const r of unanswered) {
    await notify({
      userId: r.reviewerId,
      type: "INFO",
      category: "REVIEWS",
      link: "/dashboard/reviewer-queue",
      title: "Can you review this manuscript?",
      message: `You were invited to review "${r.article.title}" and haven't responded yet. Please accept or decline so the editor can plan — it only takes a click.`,
      articleId: r.articleId,
    });
    await db.review.update({ where: { id: r.id }, data: { invitationNudgedAt: now } });
  }

  const active = { in: ["ACCEPTED", "IN_PROGRESS"] };
  const dueSoon = await db.review.findMany({
    where: { status: active, dueSoonRemindedAt: null, dueDate: { gt: now, lte: new Date(now.getTime() + 3 * DAY) } },
    include,
    take: 200,
  });
  for (const r of dueSoon) {
    const days = Math.max(1, Math.ceil((r.dueDate!.getTime() - now.getTime()) / DAY));
    await notify({
      userId: r.reviewerId,
      type: "INFO",
      category: "REVIEWS",
      link: `/dashboard/reviewer-form/${r.id}`,
      title: `Review due in ${days} day${days === 1 ? "" : "s"}`,
      message: `Your review of "${r.article.title}" is due on ${r.dueDate!.toDateString()}. Your draft is saved — pick up where you left off.`,
      articleId: r.articleId,
    });
    await db.review.update({ where: { id: r.id }, data: { dueSoonRemindedAt: now } });
  }

  const overdue = await db.review.findMany({
    // Overdue by up to a month; older ones are long past a reminder.
    where: { status: active, overdueRemindedAt: null, dueDate: { lte: now, gte: new Date(now.getTime() - 30 * DAY) } },
    include: { ...include, reviewer: { select: { fullName: true } } },
    take: 200,
  });
  for (const r of overdue) {
    await notify({
      userId: r.reviewerId,
      type: "WARNING",
      category: "REVIEWS",
      link: `/dashboard/reviewer-form/${r.id}`,
      title: "Your review is overdue",
      message: `Your review of "${r.article.title}" was due on ${r.dueDate!.toDateString()}. If you need more time, please let the editor know.`,
      articleId: r.articleId,
    });
    const editors = await editorsForReview(r.id);
    await notifyMany(
      editors.map((userId) => ({
        userId,
        type: "WARNING" as const,
        category: "EDITORIAL" as const,
        link: "/dashboard/editor-queue",
        title: "A review is overdue",
        message: `${r.reviewer.fullName}'s review of "${r.article.title}" was due on ${r.dueDate!.toDateString()}. The reviewer has been reminded.`,
        articleId: r.articleId,
      }))
    );
    await db.review.update({ where: { id: r.id }, data: { overdueRemindedAt: now } });
  }

  return { nudged: unanswered.length, dueSoon: dueSoon.length, overdue: overdue.length };
}
