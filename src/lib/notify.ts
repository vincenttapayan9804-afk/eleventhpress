import { db } from "@/lib/db";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { APP_BASE_URL } from "@/lib/site";
import { emailBrandOf } from "@/lib/email-brand";
import type { EmailBrand } from "@/lib/email";
import {
  emailDecision,
  getPreferences,
  unsubscribeToken,
  type NotificationCategory,
} from "@/lib/notification-prefs";

export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
export type { NotificationCategory } from "@/lib/notification-prefs";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  articleId?: string;
  /** What it's about, for the recipient's email preferences. Defaults to GENERAL. */
  category?: NotificationCategory;
  /** In-app path opened when it's clicked; defaults to the article when there is one. */
  link?: string;
}

export const PREFERENCES_PATH = "/dashboard/profile#notifications";

function emailFor(i: NotifyInput, brand: EmailBrand | undefined, userId: string, category: NotificationCategory) {
  const ctaUrl = i.link ? `${APP_BASE_URL}${i.link}` : i.articleId ? `${APP_BASE_URL}/article/${i.articleId}` : undefined;
  const unsubscribeUrl = `${APP_BASE_URL}/unsubscribe?token=${unsubscribeToken(userId, category)}`;
  return {
    subject: i.title,
    html: notificationEmailHtml({
      title: i.title,
      message: i.message,
      ctaUrl,
      ctaLabel: ctaUrl ? (i.articleId && !i.link ? "View article" : "Open") : undefined,
      brand,
      unsubscribeUrl,
      preferencesUrl: `${APP_BASE_URL}${PREFERENCES_PATH}`,
    }),
    // RFC 8058 one-click unsubscribe, honoured by Gmail and Outlook.
    headers: {
      "List-Unsubscribe": `<${APP_BASE_URL}/api/notifications/unsubscribe?token=${unsubscribeToken(userId, category)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/**
 * Creates the in-app Notification row and emails it according to the
 * recipient's preferences (src/lib/notification-prefs.ts): right away, in
 * the daily digest (src/lib/notification-digest.ts), or not at all. This
 * is the only place that should call db.notification.create(Many)
 * directly — every route that notifies a user should go through
 * notify()/notifyMany().
 *
 * Runs on Vercel serverless, where a response ending the request can
 * freeze anything still pending — so the email send is awaited, not
 * fire-and-forget. It's still safe to await unconditionally because
 * sendEmail() never throws (src/lib/email.ts fails open internally).
 */
export async function notify(input: NotifyInput): Promise<void> {
  await notifyMany([input]);
}

/** Bulk variant (e.g. every editor hearing about a new submission). */
export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const userIds = [...new Set(inputs.map((i) => i.userId))];
  const [users, prefsList] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, tenant: true } }),
    Promise.all(userIds.map(async (id) => [id, await getPreferences(id).catch(() => null)] as const)),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const prefsById = new Map(prefsList);

  await Promise.allSettled(
    inputs.map(async (i) => {
      const category = i.category ?? "GENERAL";
      const user = userById.get(i.userId);
      const prefs = prefsById.get(i.userId);
      // Preferences that can't be read fail open to an instant email, as before.
      const decision = user?.email ? (prefs ? emailDecision(prefs, category) : "now") : "none";
      let emailedAt: Date | null = null;
      if (decision === "now" && user?.email) {
        const result = await sendEmail({ to: user.email, ...emailFor(i, emailBrandOf(user.tenant), i.userId, category) });
        if (result.ok) emailedAt = new Date();
      }
      await db.notification.create({
        data: {
          userId: i.userId,
          type: i.type,
          category,
          link: i.link,
          title: i.title,
          message: i.message,
          articleId: i.articleId,
          emailedAt,
        },
      });
    })
  );
}
