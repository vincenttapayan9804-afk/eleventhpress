import crypto from "node:crypto";
import { db } from "@/lib/db";

/**
 * Notification categories and per-user email preferences.
 *
 * Every notification is shown in-app. Whether it is also emailed — right
 * away, in one daily digest, or not at all — follows the recipient's
 * NotificationPreference row (defaults: instant, nothing muted). Security
 * and sign-in emails don't go through here and are always sent.
 */

export const NOTIFICATION_CATEGORIES = ["SUBMISSIONS", "REVIEWS", "EDITORIAL", "ACCOUNT", "BILLING", "GENERAL"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  SUBMISSIONS: { label: "My submissions", description: "Decisions, status changes, DOIs and corrections on your work" },
  REVIEWS: { label: "Reviewing", description: "Review invitations, reminders and reviews of articles you handle" },
  EDITORIAL: { label: "Editorial", description: "New submissions and completed reviews for editors" },
  ACCOUNT: { label: "Account", description: "Applications, roles and account updates" },
  BILLING: { label: "Payments", description: "Receipts, invoices and royalties" },
  GENERAL: { label: "Other updates", description: "Everything else" },
};

export const EMAIL_MODES = ["INSTANT", "DAILY", "OFF"] as const;
export type EmailMode = (typeof EMAIL_MODES)[number];

export interface Preferences {
  emailMode: EmailMode;
  mutedCategories: NotificationCategory[];
}

export const DEFAULT_PREFERENCES: Preferences = { emailMode: "INSTANT", mutedCategories: [] };

export function isCategory(v: unknown): v is NotificationCategory {
  return typeof v === "string" && (NOTIFICATION_CATEGORIES as readonly string[]).includes(v);
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const row = await db.notificationPreference.findUnique({ where: { userId } });
  if (!row) return DEFAULT_PREFERENCES;
  return {
    emailMode: (EMAIL_MODES as readonly string[]).includes(row.emailMode) ? (row.emailMode as EmailMode) : "INSTANT",
    mutedCategories: row.mutedCategories.filter(isCategory),
  };
}

export async function savePreferences(userId: string, prefs: Preferences): Promise<Preferences> {
  const data = { emailMode: prefs.emailMode, mutedCategories: [...new Set(prefs.mutedCategories.filter(isCategory))] };
  await db.notificationPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return data;
}

/** What to do with a new notification's email under these preferences. */
export function emailDecision(prefs: Preferences, category: NotificationCategory): "now" | "digest" | "none" {
  if (prefs.emailMode === "OFF" || prefs.mutedCategories.includes(category)) return "none";
  return prefs.emailMode === "DAILY" ? "digest" : "now";
}

// ── Unsubscribe links ───────────────────────────────────────────────────
// A signed token naming the user and (optionally) one category, so an
// email's unsubscribe link works without signing in and can't be forged
// for someone else.

function secret(): string {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production" ? "epip-dev-only-insecure-secret-do-not-use-in-prod" : "")
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(`unsubscribe:${payload}`).digest("base64url").slice(0, 32);
}

/** Token for "stop these emails": one category, or all notification emails when category is omitted. */
export function unsubscribeToken(userId: string, category?: NotificationCategory): string {
  const payload = `${userId}.${category ?? "ALL"}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readUnsubscribeToken(token: string): { userId: string; category: NotificationCategory | null } | null {
  const [encoded, mac] = token.split(".");
  if (!encoded || !mac || !secret()) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  if (expected.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  const dot = payload.lastIndexOf(".");
  const userId = payload.slice(0, dot);
  const cat = payload.slice(dot + 1);
  if (!userId) return null;
  if (cat === "ALL") return { userId, category: null };
  return isCategory(cat) ? { userId, category: cat } : null;
}

/** Applies an unsubscribe: mutes the category, or turns notification email off. */
export async function applyUnsubscribe(userId: string, category: NotificationCategory | null): Promise<Preferences> {
  const prefs = await getPreferences(userId);
  if (!category) return savePreferences(userId, { ...prefs, emailMode: "OFF" });
  return savePreferences(userId, { ...prefs, mutedCategories: [...prefs.mutedCategories, category] });
}
