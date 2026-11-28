import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { DUE_SOON_DAYS, dueState, deviceState } from "@/lib/compliance";
import { KIND_DEFS, isEventKind, summarizeRecords, type RecordKind } from "@/lib/compliance-records";

const DAY = 86_400_000;
/** At most one reminder email-notification a week, however many items are due. */
const MIN_GAP_DAYS = 7;

export interface ReminderItem {
  kind: "policy" | "device" | "record" | "event";
  name: string;
  state: "DUE_SOON" | "OVERDUE";
  due: Date | null;
}

/** Pure: which adopted policies and active devices need attention. */
export function dueItems(
  policies: { title: string; status: string; nextReviewDue: Date | null }[],
  devices: { label: string; retiredAt: Date | null; lastCheckedAt: Date | null; nextCheckDue: Date | null; checks: string }[],
  now: Date
): ReminderItem[] {
  const out: ReminderItem[] = [];
  for (const p of policies) {
    if (p.status !== "ADOPTED") continue;
    const st = dueState(p.nextReviewDue, now);
    if (st !== "CURRENT") out.push({ kind: "policy", name: p.title, state: st, due: p.nextReviewDue });
  }
  for (const d of devices) {
    const st = deviceState(d, now);
    if (st === "DUE_SOON" || st === "OVERDUE") out.push({ kind: "device", name: d.label, state: st, due: d.nextCheckDue });
  }
  return out.sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0));
}

/** Pure: living records (risks, suppliers, keys, assessments) that are due, plus yearly events not done or due. */
export function recordDueItems(
  records: { kind: string; title: string; status: string; nextDue: Date | null; lastDoneAt: Date | null; data: string }[],
  now: Date,
  registerInUse: boolean
): ReminderItem[] {
  const out: ReminderItem[] = [];
  for (const r of records) {
    if (r.status !== "ACTIVE" || isEventKind(r.kind)) continue;
    const st = dueState(r.nextDue, now);
    if (st !== "CURRENT") out.push({ kind: "record", name: `${r.title} (${KIND_DEFS[r.kind as RecordKind]?.label.toLowerCase() ?? "record"})`, state: st, due: r.nextDue });
  }
  if (registerInUse) {
    for (const label of summarizeRecords(records, now).eventsNeeded) {
      out.push({ kind: "event", name: label, state: label.includes("due soon") ? "DUE_SOON" : "OVERDUE", due: null });
    }
  }
  return out;
}

export function reminderMessage(items: ReminderItem[]): string {
  const line = (i: ReminderItem) =>
    i.kind === "event"
      ? `• ${i.name}`
      : `• ${i.name} (${i.kind === "policy" ? "policy review" : i.kind === "device" ? "device check" : "review"} ${i.state === "OVERDUE" ? "overdue" : `due ${i.due?.toISOString().slice(0, 10)}`})`;
  const shown = items.slice(0, 15).map(line).join("\n");
  const more = items.length > 15 ? `\n…and ${items.length - 15} more.` : "";
  return `${items.length} item${items.length === 1 ? " needs" : "s need"} your attention in the Compliance Register (due within ${DUE_SOON_DAYS} days or overdue):\n${shown}${more}`;
}

/**
 * Weekly nudge to the platform owner(s), run daily from /api/cron/sweep-all.
 * It only reminds: a review is recorded only when the owner does it.
 */
export async function sendComplianceReminders(now = new Date()): Promise<{ sent: number; items: number }> {
  const last = await db.auditLog.findFirst({ where: { action: "COMPLIANCE_REMINDER_SENT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && now.getTime() - last.createdAt.getTime() < MIN_GAP_DAYS * DAY) return { sent: 0, items: 0 };

  const [policies, devices, records] = await Promise.all([
    db.compliancePolicy.findMany({ where: { status: "ADOPTED" }, select: { title: true, status: true, nextReviewDue: true } }),
    db.complianceDevice.findMany({ where: { retiredAt: null }, select: { label: true, retiredAt: true, lastCheckedAt: true, nextCheckDue: true, checks: true } }),
    db.complianceRecord.findMany({ select: { kind: true, title: true, status: true, nextDue: true, lastDoneAt: true, data: true } }),
  ]);
  const items = [...dueItems(policies, devices, now), ...recordDueItems(records, now, policies.length > 0)];
  if (items.length === 0) return { sent: 0, items: 0 };

  const owners = await db.user.findMany({ where: { role: "SUPER_ADMIN", tenantId: null }, select: { id: true } });
  for (const o of owners) {
    await notify({ userId: o.id, type: items.some((i) => i.state === "OVERDUE") ? "WARNING" : "INFO", title: "Compliance reviews due", message: reminderMessage(items), link: "/dashboard/compliance" });
  }
  if (owners.length) {
    await db.auditLog.create({ data: { userId: null, action: "COMPLIANCE_REMINDER_SENT", entityType: "COMPLIANCE", entityId: "reminders", metadata: JSON.stringify({ items: items.length }) } });
  }
  return { sent: owners.length, items: items.length };
}
