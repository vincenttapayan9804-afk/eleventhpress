/**
 * Daily anomaly check over the audit log (Phase 3).
 *
 * It looks at the last 24 hours of audit entries, applies a short list of
 * fixed rules, and tells the platform owner when one is broken. It does not
 * block anything and does not learn a baseline: a rule is a plain count, so
 * the owner can see exactly why an alert fired. Only counts are sent, never
 * email addresses or network addresses.
 */
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

const HOUR = 3_600_000;
/** Do not alert more than about once a day, however often the job runs. */
const MIN_GAP_HOURS = 20;

export interface AuditEvent {
  action: string;
  entityId: string;
}

export interface Anomaly {
  rule: string;
  message: string;
  count: number;
}

interface Rule {
  rule: string;
  actions: string[];
  threshold: number;
  /** When set, the count is of repeats against one entity (for example one account). */
  perEntity?: boolean;
  message: (count: number) => string;
}

export const ALERT_RULES: Rule[] = [
  { rule: "failed-signins", actions: ["LOGIN_FAILURE"], threshold: 25, message: (n) => `${n} failed sign-in attempts in 24 hours.` },
  { rule: "failed-signins-one-account", actions: ["LOGIN_FAILURE"], threshold: 8, perEntity: true, message: (n) => `One account had ${n} failed sign-in attempts in 24 hours.` },
  { rule: "password-resets", actions: ["PASSWORD_RESET_REQUESTED"], threshold: 10, message: (n) => `${n} password reset requests in 24 hours.` },
  { rule: "role-changes", actions: ["ROLE_CHANGE"], threshold: 1, message: (n) => `${n} account role change${n === 1 ? "" : "s"} in 24 hours. Check that you made ${n === 1 ? "it" : "them"}.` },
  { rule: "deletions", actions: ["ACCOUNT_DELETED", "ARTICLE_DELETED", "BOOK_DELETED"], threshold: 5, message: (n) => `${n} accounts, articles or books deleted in 24 hours.` },
  { rule: "ai-guard", actions: ["AI_INPUT_FLAGGED"], threshold: 10, message: (n) => `${n} AI requests were flagged as possible prompt-injection attempts in 24 hours.` },
];

/** Pure: which rules are broken by these audit entries. */
export function detectAnomalies(events: AuditEvent[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of ALERT_RULES) {
    const mine = events.filter((e) => r.actions.includes(e.action));
    let count = mine.length;
    if (r.perEntity) {
      const per = new Map<string, number>();
      for (const e of mine) per.set(e.entityId, (per.get(e.entityId) ?? 0) + 1);
      count = Math.max(0, ...per.values());
    }
    if (count >= r.threshold) out.push({ rule: r.rule, message: r.message(count), count });
  }
  return out;
}

export function alertMessage(found: Anomaly[]): string {
  return `${found.length} unusual pattern${found.length === 1 ? "" : "s"} in the last 24 hours:\n${found.map((a) => `• ${a.message}`).join("\n")}\nThese are simple counts from the audit log. Open the audit log to see what happened.`;
}

/** Run from /api/cron/sweep-all. Tells the platform owner(s); changes nothing else. */
export async function runSecurityAlerts(now = new Date()): Promise<{ anomalies: number; sent: number }> {
  const last = await db.auditLog.findFirst({ where: { action: "SECURITY_ALERT_SENT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && now.getTime() - last.createdAt.getTime() < MIN_GAP_HOURS * HOUR) return { anomalies: 0, sent: 0 };

  const since = new Date(now.getTime() - 24 * HOUR);
  const actions = [...new Set(ALERT_RULES.flatMap((r) => r.actions))];
  const events = await db.auditLog.findMany({ where: { action: { in: actions }, createdAt: { gte: since } }, select: { action: true, entityId: true }, take: 20_000 });
  const found = detectAnomalies(events);
  if (found.length === 0) return { anomalies: 0, sent: 0 };

  const owners = await db.user.findMany({ where: { role: "SUPER_ADMIN", tenantId: null }, select: { id: true } });
  for (const o of owners) {
    await notify({ userId: o.id, type: "WARNING", title: "Unusual activity on the platform", message: alertMessage(found), link: "/dashboard/compliance" });
  }
  await db.auditLog.create({ data: { userId: null, action: "SECURITY_ALERT_SENT", entityType: "COMPLIANCE", entityId: "alerts", metadata: JSON.stringify({ rules: found.map((f) => f.rule) }) } });
  return { anomalies: found.length, sent: owners.length };
}
