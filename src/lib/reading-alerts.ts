import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { articlePath } from "@/lib/spa-routes";

export const ALERT_KINDS = ["SEARCH", "DISCIPLINE", "AUTHOR", "MAGAZINE"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

const DAY = 86400000;

/** A plain-language name for an alert. */
export function alertLabel(kind: string, query: string): string {
  switch (kind) {
    case "SEARCH": return `Articles mentioning “${query}”`;
    case "DISCIPLINE": return `New in ${query}`;
    case "AUTHOR": return `New work by ${query}`;
    case "MAGAZINE": return "New magazine issues";
    default: return query;
  }
}

/**
 * Sends due reading alerts (run daily from /api/cron/sweep-all): for each
 * alert whose period has passed, the publications since it last ran that
 * match it become one notification (and, per the reader's email
 * preferences, an email or a line in their daily summary).
 */
export async function sendReadingAlerts(now = new Date()): Promise<{ checked: number; sent: number }> {
  const alerts = await db.readingAlert.findMany({ take: 2000 });
  let sent = 0;
  let checked = 0;
  for (const a of alerts) {
    const period = a.frequency === "DAILY" ? DAY : 7 * DAY;
    const since = a.lastSentAt ?? a.createdAt;
    if (now.getTime() - since.getTime() < period - 3600000) continue;
    checked++;
    let titles: { title: string; link: string }[] = [];
    if (a.kind === "MAGAZINE") {
      const issues = await db.magazineIssue.findMany({
        where: { status: "PUBLISHED", publishedAt: { gt: since, lte: now } },
        select: { id: true, title: true, theme: true, volume: true, issueNumber: true },
        take: 10,
      });
      titles = issues.map((i) => ({ title: i.title || i.theme || `Vol. ${i.volume}, No. ${i.issueNumber}`, link: `/magazines/${i.id}` }));
    } else {
      const contains = { contains: a.query, mode: "insensitive" as const };
      const where =
        a.kind === "DISCIPLINE"
          ? { discipline: { equals: a.query, mode: "insensitive" as const } }
          : a.kind === "AUTHOR"
            ? { authors: contains }
            : { OR: [{ title: contains }, { abstract: contains }, { keywords: contains }] };
      const articles = await db.article.findMany({
        where: { status: "PUBLISHED", publishedAt: { gt: since, lte: now }, ...where },
        select: { id: true, title: true },
        orderBy: { publishedAt: "desc" },
        take: 10,
      });
      titles = articles.map((x) => ({ title: x.title, link: articlePath(x.id, x.title) }));
    }
    await db.readingAlert.update({ where: { id: a.id }, data: { lastSentAt: now } });
    if (!titles.length) continue;
    const label = alertLabel(a.kind, a.query);
    await notify({
      userId: a.userId,
      type: "INFO",
      category: "ALERTS",
      link: titles.length === 1 ? titles[0].link : "/dashboard/library",
      title: `${label}: ${titles.length} new`,
      message: titles.map((t) => `“${t.title}”`).join(" · "),
    });
    sent++;
  }
  return { checked, sent };
}

/** When an article is published, tell the followers of its corresponding author. */
export async function notifyFollowersOfPublication(article: { id: string; title: string; correspondingAuthorId: string | null }) {
  if (!article.correspondingAuthorId) return;
  const [author, follows] = await Promise.all([
    db.user.findUnique({ where: { id: article.correspondingAuthorId }, select: { fullName: true } }),
    db.follow.findMany({ where: { followingId: article.correspondingAuthorId }, select: { followerId: true }, take: 5000 }),
  ]);
  for (const f of follows) {
    await notify({
      userId: f.followerId,
      type: "INFO",
      category: "ALERTS",
      link: articlePath(article.id, article.title),
      title: `New from ${author?.fullName ?? "an author you follow"}`,
      message: `“${article.title}” has just been published.`,
    });
  }
}
