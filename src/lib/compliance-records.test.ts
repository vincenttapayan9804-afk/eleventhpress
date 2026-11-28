import { describe, expect, test } from "bun:test";
import { RECORD_SEEDS } from "@/lib/compliance-record-seeds";
import { dueItems, recordDueItems, reminderMessage } from "@/lib/compliance-reminders";
import {
  KIND_DEFS,
  RECORD_KINDS,
  canActivate,
  cleanRecordData,
  latestEvents,
  missingRequired,
  publicSubprocessors,
  recordOpenNotes,
  recordState,
  summarizeRecords,
} from "@/lib/compliance-records";

const NOW = new Date("2027-01-10T12:00:00Z");
const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("record data", () => {
  test("keeps only known fields, trimmed, and rejects unknown select values", () => {
    const out = cleanRecordData("RISK", { description: "  x  ", likelihood: "HIGH", impact: "ENORMOUS", extra: "no" });
    expect(out.description).toBe("x");
    expect(out.likelihood).toBe("HIGH");
    expect(out.impact).toBe("");
    expect("extra" in out).toBe(false);
  });
  test("lists required fields that are empty", () => {
    expect(missingRequired("SUPPLIER", cleanRecordData("SUPPLIER", { purpose: "Email" }))).toEqual(["What data it receives", "Where it processes data", "Agreement and safeguards"]);
  });
  test("a note anywhere blocks confirming", () => {
    const data = cleanRecordData("SUPPLIER", { purpose: "a", dataShared: "b", location: "c [CONFIRM: where?]", safeguards: "d" });
    expect(recordOpenNotes("Acme", data)).toHaveLength(1);
    expect(canActivate("SUPPLIER", "Acme", data).ok).toBe(false);
    expect(canActivate("SUPPLIER", "Acme", { ...data, location: "EU" }).ok).toBe(true);
  });
  test("a short assessment cannot be confirmed", () => {
    const data = cleanRecordData("ASSESSMENT", { type: "DPIA", scope: "x", body: "too short" });
    expect(canActivate("ASSESSMENT", "DPIA", data).ok).toBe(false);
  });
});

describe("starting records", () => {
  test("every seed has a unique key and valid kind", () => {
    const keys = RECORD_SEEDS.map((s) => s.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of RECORD_SEEDS) expect(RECORD_KINDS).toContain(s.kind);
  });
  test("no seed can be confirmed as loaded: each still needs the owner", () => {
    for (const s of RECORD_SEEDS) {
      const data = cleanRecordData(s.kind, s.data);
      expect(canActivate(s.kind, s.title, data).ok).toBe(false);
    }
  });
  test("seeds keep inside field limits and never contain a secret value", () => {
    for (const s of RECORD_SEEDS) {
      for (const f of KIND_DEFS[s.kind].fields) expect((s.data[f.key] ?? "").length).toBeLessThanOrEqual(f.max);
      expect(JSON.stringify(s)).not.toMatch(/sk-[a-z0-9]{10}|BEGIN (RSA|PRIVATE)/i);
    }
  });
  test("suppliers are not claimed as certified or audited", () => {
    const text = JSON.stringify(RECORD_SEEDS).toLowerCase();
    expect(text).not.toMatch(/certified|soc ?2 type|iso ?27001/);
  });
});

describe("public sub-processor list", () => {
  const complete = { purpose: "Email", dataShared: "Addresses", location: "US", safeguards: "Terms accepted" };
  const row = (over: Record<string, unknown>) => ({ kind: "SUPPLIER", title: "Acme", status: "ACTIVE", isPublic: true, data: JSON.stringify(complete), ...over });
  test("lists only active, public, complete suppliers", () => {
    const out = publicSubprocessors([
      row({}),
      row({ title: "Draft", status: "DRAFT" }),
      row({ title: "Hidden", isPublic: false }),
      row({ title: "Open note", data: JSON.stringify({ ...complete, location: "[CONFIRM: where]" }) }),
      row({ title: "Incomplete", data: JSON.stringify({ purpose: "x" }) }),
      row({ title: "A risk", kind: "RISK" }),
    ]);
    expect(out.map((o) => o.name)).toEqual(["Acme"]);
    expect(Object.keys(out[0]).sort()).toEqual(["dataShared", "location", "name", "purpose"]);
  });
});

describe("states and reminders", () => {
  test("record states", () => {
    expect(recordState({ status: "DRAFT", nextDue: null }, NOW)).toBe("DRAFT");
    expect(recordState({ status: "ACTIVE", nextDue: d("2027-12-01") }, NOW)).toBe("CURRENT");
    expect(recordState({ status: "ACTIVE", nextDue: d("2027-01-20") }, NOW)).toBe("DUE_SOON");
    expect(recordState({ status: "ACTIVE", nextDue: d("2026-12-01") }, NOW)).toBe("OVERDUE");
  });
  const ev = (kind: string, type: string, done: string, due: string) => ({ kind, title: "x", status: "ACTIVE", lastDoneAt: d(done), nextDue: d(due), data: JSON.stringify(type ? { type } : {}) });
  test("only the latest event of each type counts", () => {
    const rows = [ev("EXERCISE", "RESTORE_DRILL", "2025-01-01", "2026-01-01"), ev("EXERCISE", "RESTORE_DRILL", "2026-12-01", "2027-12-01")];
    expect(latestEvents(rows)).toHaveLength(1);
    expect(summarizeRecords(rows, NOW).eventsNeeded).toEqual(["Yearly access review (not done yet)", "Incident walk-through (not done yet)"]);
  });
  test("an overdue yearly event is reported", () => {
    const rows = [ev("ACCESS_REVIEW", "", "2025-01-01", "2026-01-01")];
    expect(summarizeRecords(rows, NOW).eventsNeeded).toContain("Yearly access review (overdue)");
  });
  test("event reminders only appear once the register is in use", () => {
    expect(recordDueItems([], NOW, false)).toHaveLength(0);
    expect(recordDueItems([], NOW, true).length).toBe(3);
  });
  test("drafts are never reminded about; overdue active records are", () => {
    const rows = [
      { kind: "RISK", title: "Draft risk", status: "DRAFT", nextDue: null, lastDoneAt: null, data: "{}" },
      { kind: "KEY", title: "Old key", status: "ACTIVE", nextDue: d("2026-06-01"), lastDoneAt: d("2025-06-01"), data: "{}" },
    ];
    const items = recordDueItems(rows, NOW, false);
    expect(items.map((i) => i.name)).toEqual(["Old key (key or secret)"]);
    expect(reminderMessage([...dueItems([], [], NOW), ...items])).toContain("Old key");
  });
});
