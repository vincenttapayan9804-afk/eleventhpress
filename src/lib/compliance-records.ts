/**
 * Compliance Register, phase 2: risks, assessments, suppliers, keys, yearly
 * access reviews and exercises (restore drill, incident tabletop).
 *
 * Same honesty rules as phase 1 (see compliance.ts):
 *  - Everything is written or confirmed by the SUPER_ADMIN. Starting records
 *    load as DRAFT and become ACTIVE only when every [CONFIRM: …] note is
 *    answered and every required field is filled.
 *  - A review, key rotation, access review or exercise is recorded only when
 *    the owner records it. The register stores the date and reminds.
 *  - The only public output is the sub-processor list, and only for suppliers
 *    the owner has completed, activated and chosen to list.
 */
import { addMonths, dueState, openConfirmNotes } from "@/lib/compliance";

export const RECORD_KINDS = ["RISK", "ASSESSMENT", "SUPPLIER", "KEY", "ACCESS_REVIEW", "EXERCISE"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const RECORD_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** Kinds that are a dated event (something that was done on a day) rather than a living record. */
export const EVENT_KINDS: readonly RecordKind[] = ["ACCESS_REVIEW", "EXERCISE"];
export function isEventKind(k: string): boolean {
  return (EVENT_KINDS as readonly string[]).includes(k);
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "area" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  max: number;
}

const LEVELS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

export interface KindDef {
  kind: RecordKind;
  label: string;
  plural: string;
  intro: string;
  doneLabel: string;
  intervalMonths: number;
  fields: FieldDef[];
}

export const KIND_DEFS: Record<RecordKind, KindDef> = {
  RISK: {
    kind: "RISK",
    label: "Risk",
    plural: "Risk register",
    intro: "What could go wrong for the platform or the people who use it, how likely and how serious it would be, and what is done about it. Review each one at least once a year.",
    doneLabel: "Record review",
    intervalMonths: 12,
    fields: [
      { key: "description", label: "What could go wrong", type: "area", required: true, max: 2000 },
      { key: "likelihood", label: "How likely", type: "select", required: true, options: LEVELS, max: 20 },
      { key: "impact", label: "How serious", type: "select", required: true, options: LEVELS, max: 20 },
      { key: "controls", label: "What we do about it", type: "area", required: true, max: 2000 },
    ],
  },
  ASSESSMENT: {
    kind: "ASSESSMENT",
    label: "Assessment",
    plural: "Assessments",
    intro: "The written privacy impact assessment (DPIA), the AI impact assessment, and any threat model. Repeat each one after a significant change, and at least once a year.",
    doneLabel: "Record review",
    intervalMonths: 12,
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "DPIA", label: "Data protection impact assessment" },
          { value: "AI_IMPACT", label: "AI impact assessment" },
          { value: "THREAT_MODEL", label: "Threat model" },
          { value: "OTHER", label: "Other assessment" },
        ],
        max: 20,
      },
      { key: "scope", label: "What it covers", type: "text", required: true, max: 300 },
      { key: "body", label: "The assessment", type: "area", required: true, max: 20000 },
    ],
  },
  SUPPLIER: {
    kind: "SUPPLIER",
    label: "Supplier",
    plural: "Suppliers and sub-processors",
    intro: "Every outside service that handles platform data, and what it does. A completed, active supplier can be listed on the public Trust page as a sub-processor. Review each at least once a year.",
    doneLabel: "Record review",
    intervalMonths: 12,
    fields: [
      { key: "purpose", label: "What it is used for", type: "text", required: true, max: 300 },
      { key: "dataShared", label: "What data it receives", type: "area", required: true, max: 1000 },
      { key: "location", label: "Where it processes data", type: "text", required: true, max: 200 },
      { key: "safeguards", label: "Agreement and safeguards", type: "area", required: true, help: "For example: the supplier's data processing terms you accepted, and its security reports.", max: 1000 },
    ],
  },
  KEY: {
    kind: "KEY",
    label: "Key or secret",
    plural: "Keys and secrets",
    intro: "A list of the platform's keys and secrets: what each is for, where it is kept, and when it was last changed. Never write the secret itself here.",
    doneLabel: "Record rotation",
    intervalMonths: 12,
    fields: [
      { key: "purpose", label: "What it protects", type: "text", required: true, max: 300 },
      { key: "storedAs", label: "Where it is kept (the setting's name, never its value)", type: "text", required: true, max: 200 },
      { key: "rotationPlan", label: "How and when it is changed", type: "area", required: true, max: 1500 },
    ],
  },
  ACCESS_REVIEW: {
    kind: "ACCESS_REVIEW",
    label: "Access review",
    plural: "Access reviews",
    intro: "Once a year, check who holds an administrator or editor role and that each person still needs it.",
    doneLabel: "Record access review",
    intervalMonths: 12,
    fields: [
      { key: "accounts", label: "Accounts reviewed", type: "area", required: true, max: 8000 },
      { key: "outcome", label: "Result", type: "select", required: true, options: [{ value: "ALL_NEEDED", label: "Every account still needs its role" }, { value: "CHANGES_MADE", label: "I removed or reduced some roles" }], max: 20 },
      { key: "changes", label: "Changes made (if any)", type: "area", max: 2000 },
    ],
  },
  EXERCISE: {
    kind: "EXERCISE",
    label: "Exercise",
    plural: "Exercises",
    intro: "A real test of the plan: restore a backup into a test database, or talk through an incident from start to finish. Do each at least once a year.",
    doneLabel: "Log exercise",
    intervalMonths: 12,
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "RESTORE_DRILL", label: "Backup restore drill" },
          { value: "INCIDENT_TABLETOP", label: "Incident walk-through" },
          { value: "OTHER", label: "Other exercise" },
        ],
        max: 20,
      },
      { key: "outcome", label: "Result", type: "select", required: true, options: [{ value: "WORKED", label: "It worked as planned" }, { value: "PROBLEMS_FOUND", label: "Problems were found" }], max: 20 },
      { key: "whatHappened", label: "What you did and what happened", type: "area", required: true, max: 4000 },
      { key: "fixes", label: "What will be fixed or changed", type: "area", max: 2000 },
    ],
  },
};

export type RecordData = Record<string, string>;

export function parseRecordData(kind: string, json: string | null | undefined): RecordData {
  let raw: unknown = {};
  try {
    raw = JSON.parse(json || "{}");
  } catch {
    raw = {};
  }
  return cleanRecordData(kind, raw);
}

/** Keeps only the known fields of the kind, as trimmed strings within their length limits. */
export function cleanRecordData(kind: string, input: unknown): RecordData {
  const def = KIND_DEFS[kind as RecordKind];
  const out: RecordData = {};
  if (!def) return out;
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  for (const f of def.fields) {
    const v = typeof src[f.key] === "string" ? (src[f.key] as string).trim().slice(0, f.max) : "";
    if (f.type === "select" && f.options && !f.options.some((o) => o.value === v)) out[f.key] = "";
    else out[f.key] = v;
  }
  return out;
}

export function missingRequired(kind: string, data: RecordData): string[] {
  const def = KIND_DEFS[kind as RecordKind];
  if (!def) return [];
  return def.fields.filter((f) => f.required && !data[f.key]).map((f) => f.label);
}

/** Every unresolved [CONFIRM: …] note in the title or any field. */
export function recordOpenNotes(title: string, data: RecordData): string[] {
  return [title, ...Object.values(data)].flatMap((v) => openConfirmNotes(v ?? ""));
}

export function canActivate(
  kind: string,
  title: string,
  data: RecordData
): { ok: true } | { ok: false; reason: string } {
  const notes = recordOpenNotes(title, data);
  if (notes.length > 0) {
    return { ok: false, reason: `${notes.length} note${notes.length === 1 ? "" : "s"} marked [CONFIRM: …] still need${notes.length === 1 ? "s" : ""} your answer. Replace each with the true statement, then confirm.` };
  }
  const missing = missingRequired(kind, data);
  if (missing.length > 0) return { ok: false, reason: `Fill in: ${missing.join(", ")}.` };
  if (kind === "ASSESSMENT" && (data.body ?? "").length < 200) return { ok: false, reason: "The assessment text is too short to confirm." };
  return { ok: true };
}

export type RecordState = "DRAFT" | "RETIRED" | "CURRENT" | "DUE_SOON" | "OVERDUE";

export function recordState(r: { status: string; nextDue: Date | null }, now: Date): RecordState {
  if (r.status === "DRAFT") return "DRAFT";
  if (r.status === "RETIRED") return "RETIRED";
  return dueState(r.nextDue, now);
}

export function nextDueFrom(doneOn: Date, intervalMonths: number): Date {
  return addMonths(doneOn, intervalMonths);
}

export interface PublicSubprocessor {
  name: string;
  purpose: string;
  dataShared: string;
  location: string;
}

/** The public sub-processor list: active, owner-listed, complete suppliers only. */
export function publicSubprocessors(records: { kind: string; title: string; status: string; isPublic: boolean; data: string }[]): PublicSubprocessor[] {
  return records
    .filter((r) => r.kind === "SUPPLIER" && r.status === "ACTIVE" && r.isPublic)
    .map((r) => ({ r, d: parseRecordData("SUPPLIER", r.data) }))
    .filter(({ r, d }) => canActivate("SUPPLIER", r.title, d).ok)
    .map(({ r, d }) => ({ name: r.title, purpose: d.purpose, dataShared: d.dataShared, location: d.location }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface RecordSummary {
  byKind: Record<RecordKind, { total: number; draft: number; active: number; dueSoon: number; overdue: number }>;
  /** Event kinds with no active entry at all, or whose latest entry is overdue. */
  eventsNeeded: string[];
}

/** Of event records (access reviews, exercises), only the latest per group counts for "is it due". */
export function latestEvents<T extends { kind: string; status: string; lastDoneAt: Date | null; nextDue: Date | null; data: string }>(records: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of records) {
    if (!isEventKind(r.kind) || r.status !== "ACTIVE") continue;
    const type = r.kind === "EXERCISE" ? parseRecordData("EXERCISE", r.data).type || "OTHER" : "";
    const key = `${r.kind}:${type}`;
    const cur = best.get(key);
    if (!cur || (r.lastDoneAt?.getTime() ?? 0) > (cur.lastDoneAt?.getTime() ?? 0)) best.set(key, r);
  }
  return [...best.values()];
}

/** The events the owner is expected to repeat every year. */
export const EXPECTED_EVENTS: { key: string; label: string; kind: RecordKind; type?: string }[] = [
  { key: "ACCESS_REVIEW:", label: "Yearly access review", kind: "ACCESS_REVIEW" },
  { key: "EXERCISE:RESTORE_DRILL", label: "Backup restore drill", kind: "EXERCISE", type: "RESTORE_DRILL" },
  { key: "EXERCISE:INCIDENT_TABLETOP", label: "Incident walk-through", kind: "EXERCISE", type: "INCIDENT_TABLETOP" },
];

export function summarizeRecords(records: { kind: string; status: string; nextDue: Date | null; lastDoneAt: Date | null; data: string }[], now: Date): RecordSummary {
  const byKind = {} as RecordSummary["byKind"];
  for (const k of RECORD_KINDS) byKind[k] = { total: 0, draft: 0, active: 0, dueSoon: 0, overdue: 0 };
  for (const r of records) {
    const b = byKind[r.kind as RecordKind];
    if (!b || r.status === "RETIRED") continue;
    if (isEventKind(r.kind)) continue; // events are summarised through eventsNeeded
    b.total++;
    const s = recordState(r, now);
    if (s === "DRAFT") b.draft++;
    else {
      b.active++;
      if (s === "DUE_SOON") b.dueSoon++;
      if (s === "OVERDUE") b.overdue++;
    }
  }
  const latest = latestEvents(records);
  for (const k of EVENT_KINDS) byKind[k].total = records.filter((r) => r.kind === k && r.status === "ACTIVE").length;
  const eventsNeeded: string[] = [];
  for (const e of EXPECTED_EVENTS) {
    const r = latest.find((x) => (x.kind === e.kind) && (e.type ? parseRecordData("EXERCISE", x.data).type === e.type : true));
    if (!r) eventsNeeded.push(`${e.label} (not done yet)`);
    else {
      const st = dueState(r.nextDue, now);
      if (st !== "CURRENT") eventsNeeded.push(`${e.label} (${st === "OVERDUE" ? "overdue" : "due soon"})`);
    }
  }
  return { byKind, eventsNeeded };
}

export const ELEVATED_ROLES = ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR", "TENANT_ADMIN"] as const;
