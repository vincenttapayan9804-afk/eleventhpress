/**
 * Compliance Register: the private record of the platform's own security
 * and privacy governance (policy library, dated reviews, device checklist).
 *
 * Honesty rules, in the same spirit as DirectoryListing and the Trust page:
 *  - Everything here is self-reported and maintained by the SUPER_ADMIN. The
 *    register stores and reminds; it never creates evidence by itself.
 *  - A policy starts as a DRAFT. It can be adopted only once every
 *    [CONFIRM: …] note in the text has been resolved by the owner.
 *  - The public Trust page lists only ADOPTED, public policies, with dates.
 *    A review that is overdue is shown as overdue, never hidden.
 */

export const POLICY_STATUSES = ["DRAFT", "ADOPTED", "RETIRED"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const POLICY_CATEGORIES = ["GOVERNANCE", "SECURITY", "PRIVACY", "PEOPLE", "DEVICES", "AI", "SUPPLIERS"] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  GOVERNANCE: "Governance",
  SECURITY: "Security",
  PRIVACY: "Privacy and data",
  PEOPLE: "People",
  DEVICES: "Devices",
  AI: "AI",
  SUPPLIERS: "Suppliers",
};

export const REVIEW_OUTCOMES = ["NO_CHANGE", "UPDATED"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const DEVICE_KINDS = ["OWNER", "CONTRACTOR", "OTHER"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const DEVICE_KIND_LABELS: Record<DeviceKind, string> = {
  OWNER: "Owner's device",
  CONTRACTOR: "Contractor or volunteer's device",
  OTHER: "Other device",
};

/** The one-page checklist every device used for platform work must pass. */
export const DEVICE_CHECKS = [
  { key: "diskEncryption", label: "Whole-disk encryption is on", help: "FileVault (Mac), BitLocker (Windows), or the phone's built-in device encryption." },
  { key: "screenLock", label: "Screen locks by itself within 5 minutes and needs a password, PIN or biometric", help: "Applies to laptops, phones and tablets." },
  { key: "osUpdates", label: "System and browser updates are on automatic", help: "Security updates are installed within 14 days." },
  { key: "antiMalware", label: "Anti-malware protection is on", help: "Built-in Defender, XProtect or an equivalent product." },
  { key: "firewall", label: "The device firewall is on", help: "Built-in firewall is enough." },
  { key: "approvedApps", label: "Only apps from official stores or the vendor are installed", help: "No cracked software; no unknown browser extensions." },
  { key: "remoteWipe", label: "The device can be found, locked and wiped remotely", help: "Find My, Find My Device or similar; and platform sessions can be signed out from Profile." },
  { key: "twoStep", label: "Two-step sign-in is on for every platform account used on it", help: "Authenticator app or passkey, for the platform, hosting, database, email and code accounts." },
] as const;
export type DeviceCheckKey = (typeof DEVICE_CHECKS)[number]["key"];

export const DUE_SOON_DAYS = 30;
export const DEFAULT_REVIEW_MONTHS = 12;

/** Adds calendar months, clamping to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export type ReviewState = "DRAFT" | "RETIRED" | "CURRENT" | "DUE_SOON" | "OVERDUE";

export function dueState(nextDue: Date | null | undefined, now: Date): "CURRENT" | "DUE_SOON" | "OVERDUE" {
  if (!nextDue) return "OVERDUE";
  const ms = nextDue.getTime() - now.getTime();
  if (ms < 0) return "OVERDUE";
  if (ms <= DUE_SOON_DAYS * 86_400_000) return "DUE_SOON";
  return "CURRENT";
}

export function policyState(p: { status: string; nextReviewDue: Date | null }, now: Date): ReviewState {
  if (p.status === "DRAFT") return "DRAFT";
  if (p.status === "RETIRED") return "RETIRED";
  return dueState(p.nextReviewDue, now);
}

const CONFIRM_RE = /\[CONFIRM:[^\]]*\]/g;

/** Every unresolved [CONFIRM: …] note left in a policy text. */
export function openConfirmNotes(body: string): string[] {
  return body.match(CONFIRM_RE) ?? [];
}

export function canAdopt(body: string): { ok: true } | { ok: false; reason: string; notes: string[] } {
  const notes = openConfirmNotes(body);
  if (notes.length > 0) {
    return {
      ok: false,
      reason: `${notes.length} note${notes.length === 1 ? "" : "s"} marked [CONFIRM: …] still need${notes.length === 1 ? "s" : ""} your answer. Replace each with the true statement (or delete the line), then adopt.`,
      notes,
    };
  }
  if (body.trim().length < 200) {
    return { ok: false, reason: "The policy text is too short to adopt.", notes: [] };
  }
  return { ok: true };
}

/** Question IDs look like AIS-01.2, A&A-01.1 or I&S-03.4. */
const QID_RE = /^[A-Z&]{2,4}-\d{2}\.\d{1,2}$/;
export function parseCovers(covers: string | null | undefined): string[] {
  return (covers ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => QID_RE.test(s));
}
export function isQuestionId(s: string): boolean {
  return QID_RE.test(s);
}

export function parseDeviceChecks(json: string | null | undefined): Record<DeviceCheckKey, boolean> {
  let raw: unknown = {};
  try {
    raw = JSON.parse(json || "{}");
  } catch {
    raw = {};
  }
  const out = {} as Record<DeviceCheckKey, boolean>;
  for (const c of DEVICE_CHECKS) out[c.key] = !!(raw && typeof raw === "object" && (raw as Record<string, unknown>)[c.key] === true);
  return out;
}

export function cleanDeviceChecks(input: unknown): Record<DeviceCheckKey, boolean> {
  return parseDeviceChecks(JSON.stringify(input && typeof input === "object" ? input : {}));
}

export function deviceFailing(checks: Record<DeviceCheckKey, boolean>): string[] {
  return DEVICE_CHECKS.filter((c) => !checks[c.key]).map((c) => c.label);
}

export type DeviceState = "RETIRED" | "NOT_CHECKED" | "FAILING" | "CURRENT" | "DUE_SOON" | "OVERDUE";

export function deviceState(
  d: { retiredAt: Date | null; lastCheckedAt: Date | null; nextCheckDue: Date | null; checks: string },
  now: Date
): DeviceState {
  if (d.retiredAt) return "RETIRED";
  if (!d.lastCheckedAt) return "NOT_CHECKED";
  if (deviceFailing(parseDeviceChecks(d.checks)).length > 0) return "FAILING";
  return dueState(d.nextCheckDue, now);
}

export interface PublicRegisterRow {
  title: string;
  category: PolicyCategory;
  version: number;
  adoptedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  state: "CURRENT" | "DUE_SOON" | "OVERDUE";
}

/** What the public Trust page may show: adopted, public policies; titles and dates only. */
export function publicRegister(
  policies: {
    title: string;
    category: string;
    version: number;
    status: string;
    isPublic: boolean;
    adoptedAt: Date | null;
    lastReviewedAt: Date | null;
    nextReviewDue: Date | null;
  }[],
  now: Date
): PublicRegisterRow[] {
  return policies
    .filter((p) => p.status === "ADOPTED" && p.isPublic && p.adoptedAt)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => ({
      title: p.title,
      category: (POLICY_CATEGORIES as readonly string[]).includes(p.category) ? (p.category as PolicyCategory) : "GOVERNANCE",
      version: p.version,
      adoptedAt: p.adoptedAt!.toISOString(),
      lastReviewedAt: p.lastReviewedAt ? p.lastReviewedAt.toISOString() : null,
      nextReviewDue: p.nextReviewDue ? p.nextReviewDue.toISOString() : null,
      state: dueState(p.nextReviewDue, now),
    }));
}

export interface RegisterSummary {
  policies: { total: number; draft: number; adopted: number; retired: number; current: number; dueSoon: number; overdue: number };
  devices: { total: number; notChecked: number; failing: number; current: number; dueSoon: number; overdue: number };
}

export function registerSummary(
  policies: { status: string; nextReviewDue: Date | null }[],
  devices: { retiredAt: Date | null; lastCheckedAt: Date | null; nextCheckDue: Date | null; checks: string }[],
  now: Date
): RegisterSummary {
  const p = { total: policies.length, draft: 0, adopted: 0, retired: 0, current: 0, dueSoon: 0, overdue: 0 };
  for (const x of policies) {
    const s = policyState(x, now);
    if (s === "DRAFT") p.draft++;
    else if (s === "RETIRED") p.retired++;
    else {
      p.adopted++;
      if (s === "CURRENT") p.current++;
      else if (s === "DUE_SOON") p.dueSoon++;
      else p.overdue++;
    }
  }
  const d = { total: 0, notChecked: 0, failing: 0, current: 0, dueSoon: 0, overdue: 0 };
  for (const x of devices) {
    const s = deviceState(x, now);
    if (s === "RETIRED") continue;
    d.total++;
    if (s === "NOT_CHECKED") d.notChecked++;
    else if (s === "FAILING") d.failing++;
    else if (s === "CURRENT") d.current++;
    else if (s === "DUE_SOON") d.dueSoon++;
    else d.overdue++;
  }
  return { policies: p, devices: d };
}

/** Slugs are lowercase words joined by hyphens. */
export function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;
}
