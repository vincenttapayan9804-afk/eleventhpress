/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test";

let users: Record<string, { researchPlan: string | null }> = {};
let docCounts: Record<string, number> = {}; // key: `${userId}:${kind}`
let jobCounts: Record<string, number> = {}; // key: userId

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mock(async ({ where: { id } }: any) => users[id] ?? null),
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
    expect(usage.modules.GAP_ANALYSIS).toEqual({ used: 5, limit: 30 });
    expect(usage.modules.PRISMA_DRAFT).toEqual({ used: 1, limit: 10 });
    expect(usage.modules.TRANSCRIPTION).toEqual({ used: 4, limit: 20 });
  });
});
