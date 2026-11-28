import { describe, expect, test } from "bun:test";
import {
  addMonths, canAdopt, cleanDeviceChecks, deviceState, dueState, isQuestionId, isValidSlug, openConfirmNotes, parseCovers,
  parseDeviceChecks, policyState, publicRegister, registerSummary, DEVICE_CHECKS, DUE_SOON_DAYS,
} from "./compliance";
import { POLICY_DRAFTS } from "./compliance-policy-drafts";
import { dueItems, reminderMessage } from "./compliance-reminders";

const d = (s: string) => new Date(s + "T00:00:00.000Z");

describe("addMonths", () => {
  test("adds a year", () => expect(addMonths(d("2026-12-05"), 12).toISOString().slice(0, 10)).toBe("2027-12-05"));
  test("clamps to the end of a shorter month", () => {
    expect(addMonths(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonths(d("2027-12-31"), 2).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});

describe("review state", () => {
  const now = d("2027-01-01");
  test("current, due soon, overdue", () => {
    expect(dueState(d("2027-06-01"), now)).toBe("CURRENT");
    expect(dueState(new Date(now.getTime() + DUE_SOON_DAYS * 86_400_000), now)).toBe("DUE_SOON");
    expect(dueState(d("2026-12-31"), now)).toBe("OVERDUE");
  });
  test("an adopted policy with no date counts as overdue, never silently current", () => {
    expect(policyState({ status: "ADOPTED", nextReviewDue: null }, now)).toBe("OVERDUE");
  });
  test("drafts and retired policies have their own states", () => {
    expect(policyState({ status: "DRAFT", nextReviewDue: null }, now)).toBe("DRAFT");
    expect(policyState({ status: "RETIRED", nextReviewDue: null }, now)).toBe("RETIRED");
  });
});

describe("adoption gate", () => {
  const long = "x".repeat(300);
  test("refuses while a CONFIRM note remains", () => {
    const r = canAdopt(`${long} [CONFIRM: is this true?]`);
    expect(r.ok).toBe(false);
    expect(openConfirmNotes(`${long} [CONFIRM: a] and [CONFIRM: b]`)).toHaveLength(2);
  });
  test("refuses a stub", () => expect(canAdopt("short").ok).toBe(false));
  test("allows a finished text", () => expect(canAdopt(long).ok).toBe(true));
});

describe("devices", () => {
  const now = d("2027-01-01");
  const all = Object.fromEntries(DEVICE_CHECKS.map((c) => [c.key, true]));
  test("unknown keys are ignored and missing keys count as not passed", () => {
    const c = cleanDeviceChecks({ diskEncryption: true, bogus: true });
    expect(c.diskEncryption).toBe(true);
    expect(c.screenLock).toBe(false);
    expect((c as Record<string, unknown>).bogus).toBeUndefined();
  });
  test("bad JSON is all false", () => expect(Object.values(parseDeviceChecks("{nope")).every((v) => v === false)).toBe(true));
  test("a device passes only when every box is ticked", () => {
    const base = { retiredAt: null, lastCheckedAt: d("2026-12-01"), nextCheckDue: d("2027-12-01") };
    expect(deviceState({ ...base, checks: JSON.stringify(all) }, now)).toBe("CURRENT");
    expect(deviceState({ ...base, checks: JSON.stringify({ ...all, firewall: false }) }, now)).toBe("FAILING");
    expect(deviceState({ ...base, lastCheckedAt: null, checks: "{}" }, now)).toBe("NOT_CHECKED");
    expect(deviceState({ ...base, retiredAt: now, checks: "{}" }, now)).toBe("RETIRED");
  });
});

describe("public register", () => {
  const now = d("2027-01-01");
  const base = { category: "SECURITY", version: 1, isPublic: true, adoptedAt: d("2026-12-01"), lastReviewedAt: d("2026-12-01"), nextReviewDue: d("2027-12-01") };
  test("lists only adopted, public policies, with titles and dates only", () => {
    const rows = publicRegister(
      [
        { ...base, title: "B adopted", status: "ADOPTED" },
        { ...base, title: "A draft", status: "DRAFT", adoptedAt: null },
        { ...base, title: "C hidden", status: "ADOPTED", isPublic: false },
        { ...base, title: "D retired", status: "RETIRED" },
      ],
      now
    );
    expect(rows.map((r) => r.title)).toEqual(["B adopted"]);
    expect(Object.keys(rows[0]).sort()).toEqual(["adoptedAt", "category", "lastReviewedAt", "nextReviewDue", "state", "title", "version"]);
  });
  test("an overdue review is shown as overdue", () => {
    const rows = publicRegister([{ ...base, title: "Old", status: "ADOPTED", nextReviewDue: d("2026-06-01") }], now);
    expect(rows[0].state).toBe("OVERDUE");
  });
});

describe("summary and reminders", () => {
  const now = d("2027-01-01");
  test("counts", () => {
    const s = registerSummary(
      [
        { status: "DRAFT", nextReviewDue: null },
        { status: "ADOPTED", nextReviewDue: d("2027-12-01") },
        { status: "ADOPTED", nextReviewDue: d("2027-01-10") },
        { status: "ADOPTED", nextReviewDue: d("2026-01-10") },
      ],
      [{ retiredAt: null, lastCheckedAt: null, nextCheckDue: null, checks: "{}" }],
      now
    );
    expect(s.policies).toMatchObject({ total: 4, draft: 1, adopted: 3, current: 1, dueSoon: 1, overdue: 1 });
    expect(s.devices).toMatchObject({ total: 1, notChecked: 1 });
  });
  test("reminders skip drafts and unchecked devices, and list the rest oldest first", () => {
    const items = dueItems(
      [
        { title: "Draft", status: "DRAFT", nextReviewDue: null },
        { title: "Late", status: "ADOPTED", nextReviewDue: d("2026-12-01") },
        { title: "Soon", status: "ADOPTED", nextReviewDue: d("2027-01-15") },
        { title: "Fine", status: "ADOPTED", nextReviewDue: d("2027-09-01") },
      ],
      [{ label: "New laptop", retiredAt: null, lastCheckedAt: null, nextCheckDue: null, checks: "{}" }],
      now
    );
    expect(items.map((i) => i.name)).toEqual(["Late", "Soon"]);
    expect(reminderMessage(items)).toContain("2 items need your attention");
  });
});

describe("starting policy drafts", () => {
  test("slugs are unique and valid, titles unique", () => {
    const slugs = POLICY_DRAFTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(isValidSlug(s)).toBe(true);
    expect(new Set(POLICY_DRAFTS.map((p) => p.title)).size).toBe(POLICY_DRAFTS.length);
  });
  test("every draft covers valid question IDs and is long enough to be a real policy", () => {
    for (const p of POLICY_DRAFTS) {
      const ids = p.covers.split(/\s+/).filter(Boolean);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(isQuestionId(id)).toBe(true);
      expect(parseCovers(p.covers)).toHaveLength(ids.length);
      expect(p.body.length).toBeGreaterThan(400);
      expect(p.body).toContain("## Review");
    }
  });
  test("drafts that need owner facts cannot be adopted as shipped", () => {
    const withNotes = POLICY_DRAFTS.filter((p) => openConfirmNotes(p.body).length > 0).map((p) => p.slug);
    expect(withNotes).toEqual(expect.arrayContaining(["people-security", "continuity-and-recovery", "logging-and-monitoring", "vulnerability-and-malware"]));
  });
  test("no draft claims an independent audit or certification we do not have", () => {
    for (const p of POLICY_DRAFTS) {
      expect(p.body).not.toMatch(/\b(ISO 27001 certified|SOC 2 (Type [12] )?(certified|report)|independently audited|externally certified)\b/i);
    }
  });
});
