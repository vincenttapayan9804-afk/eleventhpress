import { db } from "@/lib/db";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { APP_BASE_URL } from "@/lib/site";

export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  articleId?: string;
}

/**
 * Creates the in-app Notification row and, best-effort, emails the same
 * content to the recipient. This is the only place that should call
 * db.notification.create(Many) directly — every route that notifies a
 * user should go through notify()/notifyMany() instead, so a notification
 * always also reaches an inbox, not just the in-app bell icon.
 *
 * Runs on Vercel serverless, where a response ending the request can
 * freeze anything still pending — so the email send is awaited, not
 * fire-and-forget. It's still safe to await unconditionally because
 * sendEmail() never throws (src/lib/email.ts fails open internally); a
 * bad address or a Resend outage is logged, not propagated, so it can
 * never fail the caller's business operation.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const [, user] = await Promise.all([
    db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        articleId: input.articleId,
      },
    }),
    db.user.findUnique({ where: { id: input.userId }, select: { email: true } }),
  ]);
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: input.title,
      html: notificationEmailHtml({
        title: input.title,
        message: input.message,
        ctaUrl: input.articleId ? `${APP_BASE_URL}/article/${input.articleId}` : undefined,
        ctaLabel: input.articleId ? "View article" : undefined,
      }),
    });
  }
}

/** Bulk variant for the editors-get-notified-of-a-new-submission shape (db.notification.createMany call sites). */
export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const userIds = [...new Set(inputs.map((i) => i.userId))];
  const [, users] = await Promise.all([
    db.notification.createMany({
      data: inputs.map((i) => ({
        userId: i.userId,
        type: i.type,
        title: i.title,
        message: i.message,
        articleId: i.articleId,
      })),
    }),
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
  ]);
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  await Promise.allSettled(
    inputs.map((i) => {
      const email = emailById.get(i.userId);
      if (!email) return Promise.resolve();
      return sendEmail({
        to: email,
        subject: i.title,
        html: notificationEmailHtml({
          title: i.title,
          message: i.message,
          ctaUrl: i.articleId ? `${APP_BASE_URL}/article/${i.articleId}` : undefined,
          ctaLabel: i.articleId ? "View article" : undefined,
        }),
      });
    })
  );
}
