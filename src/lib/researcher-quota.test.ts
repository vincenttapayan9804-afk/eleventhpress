/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";

let users: Record<string, { researchPlan: string | null; tenantId?: string | null }> = {};
let docCounts: Record<string, number> = {}; // key: `${userId}:${kind}`
let jobCounts: Record<string, number> = {}; // key: userId
let tenants: Record<string, { plan: string | null }> = {};
let entitlements: Record<string, { enabled: boolean }> = {}; // key: `${tenantId}:${moduleKey}`

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mock(async ({ where: { id } }: any) => users[id] ?? null),
    },
    tenant: {
      findUnique: mock(async ({ where: { id } }: any) => tenants[id] ?? null),
    },
    tenantEntitlement: {
      findUnique: mock(async ({ where: { tenantId_moduleKey } }: any) => {
        const key = `${tenantId_moduleKey.tenantId}:${tenantId_moduleKey.moduleKey}`;
        return entitlements[key] ?? null;
      }),
    },
    researchLabDocument: {
      count: mock(async ({ where }: any) => docCounts[`${where.userId}:${where.kind}`] ?? 0),
    },
    transcriptionJob: {
      count: mock(async ({ where }: any) => jobCounts[where.userId] ?? 0),
    },
  },
}));

const { checkResearcherQuota, getResearcherUsage } = await import("@/lib/researcher-quota");
const { RESEARCH_MODULE_KEYS, ALL_RESEARCH_MODULE_KEYS } = await import("@/lib/researcher-plans");

describe("checkResearcherQuota", () => {
  test("a user with no researchPlan is always unlimited", async () => {
    users = { "u1": { researchPlan: null } };
    docCounts = { "u1:GAP_ANALYSIS": 999 };
    const r = await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBeNull();
  });

  test("a missing user row is treated the same as no plan", async () => {
    users = {};
    const r = await checkResearcherQuota("ghost", RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
    expect(r.allowed).toBe(true);
  });

  test("an unknown plan key is treated as no plan (unlimited, never throws)", async () => {
    users = { "u1": { researchPlan: "NOT_A_REAL_PLAN" } };
    const r = await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
    expect(r.allowed).toBe(true);
  });

  test("under quota on RESEARCHER_FREE is allowed", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_FREE" } };
    docCounts = { "u1:GAP_ANALYSIS": 2 };
    const r = await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(2);
    expect(r.limit).toBe(3);
  });

  test("at/over quota on RESEARCHER_FREE is blocked", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_FREE" } };
    docCounts = { "u1:GAP_ANALYSIS": 3 };
    const r = await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
    expect(r.allowed).toBe(false);
  });

  test("quota is per-module — hitting the PRISMA_DRAFT cap doesn't block GAP_ANALYSIS", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_FREE" } };
    docCounts = { "u1:GAP_ANALYSIS": 0, "u1:PRISMA_DRAFT": 1 };
    expect((await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS)).allowed).toBe(true);
    expect((await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.PRISMA_DRAFT)).allowed).toBe(false);
  });

  test("transcription quota reads from TranscriptionJob, not ResearchLabDocument", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_FREE" } };
    jobCounts = { "u1": 2 };
    const r = await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.TRANSCRIPTION);
    expect(r.allowed).toBe(false);
    expect(r.used).toBe(2);
    expect(r.limit).toBe(2);
  });

  test("usage is scoped per user — another user's counts never leak across", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_FREE" }, "u2": { researchPlan: "RESEARCHER_FREE" } };
    docCounts = { "u1:GAP_ANALYSIS": 3 };
    expect((await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS)).allowed).toBe(false);
    expect((await checkResearcherQuota("u2", RESEARCH_MODULE_KEYS.GAP_ANALYSIS)).allowed).toBe(true);
  });
});

describe("getResearcherUsage", () => {
  test("null plan reports every module as unlimited with zero used", async () => {
    users = { "u1": { researchPlan: null } };
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBeNull();
    for (const key of ALL_RESEARCH_MODULE_KEYS) {
      expect(usage.modules[key].limit).toBeNull();
      expect(usage.modules[key].used).toBe(0);
    }
  });

  test("RESEARCHER_PRO reports real limits and usage per module", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_PRO" } };
    docCounts = { "u1:GAP_ANALYSIS": 5, "u1:PRISMA_DRAFT": 1 };
    jobCounts = { "u1": 4 };
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBe("RESEARCHER_PRO");
    expect(usage.planSource).toBe("EXPLICIT");
    expect(usage.modules.GAP_ANALYSIS).toEqual({ used: 5, limit: 30 });
    expect(usage.modules.PRISMA_DRAFT).toEqual({ used: 1, limit: 10 });
    expect(usage.modules.TRANSCRIPTION).toEqual({ used: 4, limit: 20 });
  });
});

describe("Phase 2 — bundled tenant plan fallback", () => {
  test("a user with no explicit plan on a University-tier tenant inherits the bundled plan", async () => {
    users = { "u1": { researchPlan: null, tenantId: "t1" } };
    tenants = { "t1": { plan: "UNIVERSITY_SMALL" } };
    entitlements = { "t1:research_lab": { enabled: true } };
    docCounts = { "u1:GAP_ANALYSIS": 2 };
    const r = await checkResearcherQuota("u1", RESEARCH_MODULE_KEYS.GAP_ANALYSIS);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(30); // RESEARCHER_PRO, bundled by UNIVERSITY_SMALL
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBe("RESEARCHER_PRO");
    expect(usage.planSource).toBe("BUNDLED");
  });

  test("an explicit User.researchPlan overrides the tenant's bundled plan", async () => {
    users = { "u1": { researchPlan: "RESEARCHER_FREE", tenantId: "t1" } };
    tenants = { "t1": { plan: "UNIVERSITY_LARGE" } };
    entitlements = { "t1:research_lab": { enabled: true } };
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBe("RESEARCHER_FREE");
    expect(usage.planSource).toBe("EXPLICIT");
  });

  test("a tenant with RESEARCH_LAB entitlement revoked bundles nothing", async () => {
    users = { "u1": { researchPlan: null, tenantId: "t1" } };
    tenants = { "t1": { plan: "UNIVERSITY_SMALL" } };
    entitlements = { "t1:research_lab": { enabled: false } };
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBeNull();
    expect(usage.planSource).toBeNull();
    for (const key of ALL_RESEARCH_MODULE_KEYS) expect(usage.modules[key].limit).toBeNull();
  });

  test("a tenant with no plan assigned bundles nothing", async () => {
    users = { "u1": { researchPlan: null, tenantId: "t1" } };
    tenants = { "t1": { plan: null } };
    entitlements = {};
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBeNull();
    expect(usage.planSource).toBeNull();
  });

  test("Publisher Cloud tenants have no bundled researcher plan", async () => {
    users = { "u1": { researchPlan: null, tenantId: "t1" } };
    tenants = { "t1": { plan: "PUBLISHER_CLOUD" } };
    entitlements = { "t1:research_lab": { enabled: true } };
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBeNull();
    expect(usage.planSource).toBeNull();
  });

  test("a user with no tenant never falls back to a bundled plan", async () => {
    users = { "u1": { researchPlan: null, tenantId: null } };
    const usage = await getResearcherUsage("u1");
    expect(usage.plan).toBeNull();
    expect(usage.planSource).toBeNull();
  });
});
