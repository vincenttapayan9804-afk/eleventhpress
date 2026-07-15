/// <reference types="bun-types" />
/**
 * Mocked smoke tests for the IntegrityCheckJob runner
 * (src/lib/ithenticate.ts), mirroring galley-job.smoke.test.ts's shape:
 * (1) a job that fails never gets silently lost; (2) the atomic claim
 * prevents double-processing; (3) simulation mode (no vendor credentials)
 * completes honestly with no fabricated score; (4) live mode submits to
 * the vendor and lands in SUBMITTED, not COMPLETED, since the real score
 * only arrives later via webhook; (5) the sweep never touches a job
 * that's already SUBMITTED to the real vendor.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

const ARTICLE = {
  id: "article-1",
  title: "Test Article",
  manuscriptKey: "raw-submissions/article-1.docx",
};

let jobStore: Record<string, any> = {};
let getObjectResult: Buffer | null = Buffer.from("manuscript body", "utf-8");
let auditLogCalls: any[] = [];
let articleUpdateCalls: any[] = [];
let fetchCalls: { url: string; init: any }[] = [];
let fetchShouldFail = false;

const fakeDb = {
  integrityCheckJob: {
    updateMany: mock(async ({ where, data }: any) => {
      const job = jobStore[where.id];
      if (!job) return { count: 0 };
      if (where.status && job.status !== where.status && !where.OR) return { count: 0 };
      if (where.OR) {
        const matches = where.OR.some((cond: any) => {
          if (cond.status === "QUEUED") return job.status === "QUEUED";
          if (cond.status === "PROCESSING") return job.status === "PROCESSING" && job.startedAt && job.startedAt < cond.startedAt.lt;
          return false;
        });
        if (!matches) return { count: 0 };
      }
      Object.assign(job, data);
      return { count: 1 };
    }),
    findUnique: mock(async ({ where }: any) => jobStore[where.id] || null),
    update: mock(async ({ where, data }: any) => {
      Object.assign(jobStore[where.id], data);
      return jobStore[where.id];
    }),
    findMany: mock(async ({ where, take }: any) => {
      const all = Object.values(jobStore) as any[];
      const matching = all.filter((j) =>
        where.OR.some((cond: any) => {
          if (cond.status === "QUEUED") return j.status === "QUEUED";
          if (cond.status === "PROCESSING") return j.status === "PROCESSING" && j.startedAt && j.startedAt < cond.startedAt.lt;
          return false;
        })
      );
      return matching.slice(0, take);
    }),
  },
  article: {
    findUnique: mock(async ({ where }: any) => (where.id === ARTICLE.id ? ARTICLE : null)),
    update: mock(async (args: any) => {
      articleUpdateCalls.push(args);
      return {};
    }),
  },
  auditLog: {
    create: mock(async (args: any) => {
      auditLogCalls.push(args);
      return {};
    }),
  },
};

mock.module("@/lib/db", () => ({ db: fakeDb }));
mock.module("@/lib/storage", () => ({
  getObject: mock(async () => getObjectResult),
}));

const { runIntegrityCheckJob, sweepStuckIntegrityChecks } = await import("@/lib/ithenticate");

function makeJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job-1",
    articleId: ARTICLE.id,
    inputKey: ARTICLE.manuscriptKey,
    provider: "ITHENTICATE",
    status: "QUEUED",
    mode: "simulation",
    externalSubmissionId: null,
    reportUrl: null,
    similarityScore: null,
    matchBreakdown: null,
    startedAt: null,
    errorMessage: null,
    workerLog: null,
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  jobStore[job.id] = job;
  return job;
}

function resetAll() {
  jobStore = {};
  getObjectResult = Buffer.from("manuscript body", "utf-8");
  auditLogCalls = [];
  articleUpdateCalls = [];
  fetchCalls = [];
  fetchShouldFail = false;
  delete process.env.ITHENTICATE_CLIENT_ID;
  delete process.env.ITHENTICATE_CLIENT_SECRET;
  fakeDb.integrityCheckJob.updateMany.mockClear();
  fakeDb.integrityCheckJob.findUnique.mockClear();
  fakeDb.integrityCheckJob.update.mockClear();
  fakeDb.integrityCheckJob.findMany.mockClear();
  fakeDb.article.findUnique.mockClear();
  fakeDb.article.update.mockClear();
  fakeDb.auditLog.create.mockClear();

  // @ts-expect-error test-only global fetch stub
  globalThis.fetch = mock(async (url: string, init: any) => {
    fetchCalls.push({ url, init });
    if (fetchShouldFail) throw new Error("mock network failure");
    if (url.includes("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: "fake-token" }), { status: 200 });
    }
    if (url.endsWith("/submissions")) {
      return new Response(JSON.stringify({ id: "sub-123" }), { status: 200 });
    }
    if (url.includes("/original")) {
      return new Response("", { status: 200 });
    }
    if (url.includes("/similarity")) {
      return new Response("", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
}

beforeEach(resetAll);

describe("runIntegrityCheckJob — simulation mode (no vendor credentials)", () => {
  test("completes with no fabricated score", async () => {
    makeJob();
    await runIntegrityCheckJob("job-1", "user-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
    expect(jobStore["job-1"].mode).toBe("simulation");
    expect(jobStore["job-1"].similarityScore).toBeNull();
    expect(jobStore["job-1"].workerLog).toContain("ITHENTICATE_CLIENT_ID");
    // Never touched the network in simulation mode.
    expect(fetchCalls.length).toBe(0);
  });
});

describe("runIntegrityCheckJob — live mode", () => {
  beforeEach(() => {
    process.env.ITHENTICATE_CLIENT_ID = "client-id";
    process.env.ITHENTICATE_CLIENT_SECRET = "client-secret";
  });

  test("submits to the vendor and lands in SUBMITTED, not COMPLETED", async () => {
    makeJob();
    await runIntegrityCheckJob("job-1", "user-1");
    expect(jobStore["job-1"].status).toBe("SUBMITTED");
    expect(jobStore["job-1"].mode).toBe("live");
    expect(jobStore["job-1"].externalSubmissionId).toBe("sub-123");
    expect(jobStore["job-1"].similarityScore).toBeNull();
    expect(fakeDb.auditLog.create).toHaveBeenCalledTimes(1);
  });

  test("a network failure fails the job with the error message, never silently lost", async () => {
    makeJob();
    fetchShouldFail = true;
    await runIntegrityCheckJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toContain("mock network failure");
  });

  test("fails when the manuscript is missing from storage", async () => {
    makeJob();
    getObjectResult = null;
    await runIntegrityCheckJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toContain("Manuscript not found");
  });
});

describe("runIntegrityCheckJob — failure never gets silently lost", () => {
  test("marks the job FAILED when the article no longer exists", async () => {
    makeJob({ articleId: "does-not-exist" });
    await runIntegrityCheckJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toBe("Article no longer exists");
  });
});

describe("runIntegrityCheckJob — atomic claim prevents double-processing", () => {
  test("a claim that doesn't match claimFilter is a no-op", async () => {
    makeJob({ status: "COMPLETED", mode: "simulation" });
    await runIntegrityCheckJob("job-1", null, { status: "QUEUED" });
    expect(fakeDb.article.findUnique).not.toHaveBeenCalled();
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });

  test("an unconditional claim always proceeds regardless of current status", async () => {
    makeJob({ status: "FAILED", errorMessage: "previous failure" });
    await runIntegrityCheckJob("job-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("sweepStuckIntegrityChecks", () => {
  test("retries a QUEUED job and a stale-PROCESSING job, ignoring SUBMITTED and fresh-PROCESSING", async () => {
    makeJob({ id: "queued-1", status: "QUEUED" });
    makeJob({ id: "stale-1", status: "PROCESSING", startedAt: new Date(Date.now() - 20 * 60 * 1000) });
    makeJob({ id: "fresh-1", status: "PROCESSING", startedAt: new Date() });
    makeJob({ id: "submitted-1", status: "SUBMITTED", externalSubmissionId: "sub-999" });

    const result = await sweepStuckIntegrityChecks(5, 10);

    expect(result.swept).toBe(2);
    expect(result.jobIds.sort()).toEqual(["queued-1", "stale-1"].sort());
    expect(jobStore["queued-1"].status).toBe("COMPLETED"); // simulation mode by default
    expect(jobStore["stale-1"].status).toBe("COMPLETED");
    expect(jobStore["fresh-1"].status).toBe("PROCESSING");
    expect(jobStore["submitted-1"].status).toBe("SUBMITTED"); // never touched
  });

  test("respects the batch limit", async () => {
    for (let i = 0; i < 8; i++) makeJob({ id: `job-${i}`, status: "QUEUED" });
    const result = await sweepStuckIntegrityChecks(3, 10);
    expect(result.swept).toBe(3);
  });
});
