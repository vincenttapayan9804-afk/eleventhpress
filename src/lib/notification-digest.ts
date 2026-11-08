import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailBrandOf } from "@/lib/email-brand";
import { APP_BASE_URL } from "@/lib/site";
import { CATEGORY_LABELS, isCategory, unsubscribeToken } from "@/lib/notification-prefs";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Daily digest for people who chose "one email a day" (NotificationPreference
 * emailMode DAILY): every notification not yet emailed, created since they
 * chose it, in categories they haven't muted — grouped into one email.
 * Run once a day from /api/cron/sweep-all.
 */
export async function sendNotificationDigests(): Promise<{ users: number; notifications: number }> {
  const prefs = await db.notificationPreference.findMany({ where: { emailMode: "DAILY" } });
  let users = 0;
  let notifications = 0;
  for (const pref of prefs) {
    const since = new Date(Math.max(pref.updatedAt.getTime(), Date.now() - 7 * 24 * 3600 * 1000));
    const pending = await db.notification.findMany({
      where: {
        userId: pref.userId,
        emailedAt: null,
        createdAt: { gte: since },
        category: { notIn: pref.mutedCategories },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    if (pending.length === 0) continue;
    const user = await db.user.findUnique({ where: { id: pref.userId }, select: { email: true, fullName: true, tenant: true } });
    if (!user?.email) continue;
    const brand = emailBrandOf(user.tenant);
    const name = esc(brand?.name ?? "Eleventh Press");
    const color = brand?.primaryColor && /^#[0-9a-f]{3,8}$/i.test(brand.primaryColor) ? brand.primaryColor : "#42126b";
    const items = pending
      .map((n) => {
        const href = n.link ? `${APP_BASE_URL}${n.link}` : n.articleId ? `${APP_BASE_URL}/article/${n.articleId}` : `${APP_BASE_URL}/dashboard`;
        const cat = isCategory(n.category) ? CATEGORY_LABELS[n.category].label : "Update";
        return `<tr><td style="padding:14px 0;border-top:1px solid #eee;">
          <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#8a7aa0;">${esc(cat)}</div>
          <a href="${esc(href)}" style="display:block;margin-top:4px;font-size:15px;font-weight:600;color:#1a1a1a;text-decoration:none;">${esc(n.title)}</a>
          <div style="margin-top:4px;font-size:13px;line-height:1.5;color:#44404c;">${esc(n.message)}</div>
        </td></tr>`;
      })
      .join("");
    const unsubscribe = `${APP_BASE_URL}/unsubscribe?token=${unsubscribeToken(pref.userId)}`;
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2f7;font-family:sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:32px;border-top:4px solid ${color};">
        <tr><td style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${color};">${name}</td></tr>
        <tr><td style="padding-top:8px;font-size:20px;font-weight:600;color:#1a1a1a;">Your daily summary</td></tr>
        <tr><td style="padding:6px 0 10px;font-size:14px;color:#44404c;">${pending.length} update${pending.length === 1 ? "" : "s"} since your last summary.</td></tr>
        ${items}
        <tr><td style="padding-top:24px;"><a href="${APP_BASE_URL}/dashboard" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Open your dashboard</a></td></tr>
        <tr><td style="padding-top:24px;font-size:12px;color:#9a94a6;">You get one summary a day because of your email preferences. <a href="${APP_BASE_URL}/dashboard/profile#notifications" style="color:#6b6478;">Change preferences</a> · <a href="${esc(unsubscribe)}" style="color:#6b6478;">Unsubscribe</a></td></tr>
      </table></td></tr></table></body></html>`;
    const result = await sendEmail({
      to: user.email,
      subject: `Your daily summary — ${pending.length} update${pending.length === 1 ? "" : "s"}`,
      html,
      headers: {
        "List-Unsubscribe": `<${APP_BASE_URL}/api/notifications/unsubscribe?token=${unsubscribeToken(pref.userId)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (!result.ok) continue;
    await db.notification.updateMany({ where: { id: { in: pending.map((n) => n.id) } }, data: { emailedAt: new Date() } });
    users++;
    notifications += pending.length;
  }
  return { users, notifications };
}
