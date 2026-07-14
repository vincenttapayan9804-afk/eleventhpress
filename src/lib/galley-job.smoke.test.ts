/// <reference types="bun-types" />
/**
 * Mocked smoke tests for the GalleyJob runner (src/lib/galley-job.ts) —
 * the shared execution path behind the interactive endpoint, the cron
 * sweep, and the admin manual-retry action. Focuses on the two properties
 * that matter for durability: (1) a job that fails never gets silently
 * lost — it lands in FAILED with a message, not stuck; (2) the atomic
 * claim actually prevents two callers from double-processing the same job.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

const ARTICLE = {
  id: "article-1",
  title: "Test Article",
  authors: JSON.stringify([{ name: "A. Author", affiliation: "Test U." }]),
  abstract: "An abstract.",
  keywords: "test",
  discipline: "Physics",
  doi: "10.1234/test",
  manuscriptKey: "manuscripts/article-1.md",
  reviewModel: "SINGLE_BLIND",
  journal: { name: "Test Journal", issn: "1234-5678" },
  issue: { volume: 1, issueNumber: 1, year: 2026 },
};

let galleyJobStore: Record<string, any> = {};
let generateGalleysShouldFail = false;
let getObjectResult: Buffer | null = Buffer.from("manuscript body", "utf-8");
let auditLogCalls: any[] = [];

const fakeDb = {
  galleyJob: {
    updateMany: mock(async ({ where, data }: any) => {
      const job = galleyJobStore[where.id];
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
    findUnique: mock(async ({ where }: any) => galleyJobStore[where.id] || null),
    update: mock(async ({ where, data }: any) => {
      Object.assign(galleyJobStore[where.id], data);
      return galleyJobStore[where.id];
    }),
    findMany: mock(async ({ where, take }: any) => {
      const all = Object.values(galleyJobStore) as any[];
      const matching = all.filter((j) => {
        return where.OR.some((cond: any) => {
          if (cond.status === "QUEUED") return j.status === "QUEUED";
          if (cond.status === "PROCESSING") return j.status === "PROCESSING" && j.startedAt && j.startedAt < cond.startedAt.lt;
          return false;
        });
      });
      return matching.slice(0, take);
    }),
  },
  article: {
    findUnique: mock(async ({ where }: any) => (where.id === ARTICLE.id ? ARTICLE : null)),
    update: mock(async () => ({})),
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
  putObject: mock(async () => ({})),
}));
// Spreads in the real module's other exports (escapeXml, htmlToPlainText,
// extractManuscriptBody, renderMinimalErrorPdf — all pure/local, no DB or
// network access) alongside the mocked generateGalleys, rather than
// replacing the whole module. bun:test's mock.module is global per
// process, not scoped to this file — a bare-minimum mock here would break
// any other test file (e.g. book-production.smoke tests) that imports
// those other named exports from the same module path.
const realGalley = await import("@/lib/galley");
mock.module("@/lib/galley", () => ({
  ...realGalley,
  generateGalleys: mock(async () => {
    if (generateGalleysShouldFail) throw new Error("mock generateGalleys failure");
    return { htmlKey: "published-galleys/x.html", pdfKey: "published-galleys/x.pdf", jatsKey: "published-galleys/x.jats.xml", log: ["done"] };
  }),
}));

const { runGalleyJob, sweepStuckGalleyJobs } = await import("@/lib/galley-job");

function makeJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job-1",
    articleId: ARTICLE.id,
    inputKey: ARTICLE.manuscriptKey,
    status: "QUEUED",
    startedAt: null,
    errorMessage: null,
    htmlKey: null,
    pdfKey: null,
    jatsKey: null,
    workerLog: null,
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  galleyJobStore[job.id] = job;
  return job;
}

function resetAll() {
  galleyJobStore = {};
  generateGalleysShouldFail = false;
  getObjectResult = Buffer.from("manuscript body", "utf-8");
  auditLogCalls = [];
  fakeDb.galleyJob.updateMany.mockClear();
  fakeDb.galleyJob.findUnique.mockClear();
  fakeDb.galleyJob.update.mockClear();
  fakeDb.galleyJob.findMany.mockClear();
  fakeDb.article.findUnique.mockClear();
  fakeDb.article.update.mockClear();
  fakeDb.auditLog.create.mockClear();
}

beforeEach(resetAll);

describe("runGalleyJob — happy path", () => {
  test("completes a QUEUED job, updates the article, and writes an audit log", async () => {
    makeJob();
    await runGalleyJob("job-1", "user-1");
    expect(galleyJobStore["job-1"].status).toBe("COMPLETED");
    expect(galleyJobStore["job-1"].htmlKey).toBe("published-galleys/x.html");
    expect(fakeDb.article.update).toHaveBeenCalledTimes(1);
    expect(fakeDb.auditLog.create).toHaveBeenCalledTimes(1);
  });

  test("system-triggered runs (triggeredBy null) record a null userId and a system trigger tag", async () => {
    makeJob();
    await runGalleyJob("job-1", null);
    expect(auditLogCalls.length).toBe(1);
    expect(auditLogCalls[0].data.userId).toBeNull();
    expect(JSON.parse(auditLogCalls[0].data.metadata).trigger).toBe("system");
  });
});

describe("runGalleyJob — failure never gets silently lost", () => {
  test("marks the job FAILED with the error message when generation throws", async () => {
    makeJob();
    generateGalleysShouldFail = true;
    await runGalleyJob("job-1");
    expect(galleyJobStore["job-1"].status).toBe("FAILED");
    expect(galleyJobStore["job-1"].errorMessage).toContain("mock generateGalleys failure");
    expect(fakeDb.article.update).not.toHaveBeenCalled();
    expect(fakeDb.auditLog.create).not.toHaveBeenCalled();
  });

  test("marks the job FAILED when the article no longer exists", async () => {
    makeJob({ articleId: "does-not-exist" });
    await runGalleyJob("job-1");
    expect(galleyJobStore["job-1"].status).toBe("FAILED");
    expect(galleyJobStore["job-1"].errorMessage).toBe("Article no longer exists");
  });
});

describe("runGalleyJob — atomic claim prevents double-processing", () => {
  test("a claim that doesn't match claimFilter is a no-op (loses the race)", async () => {
    makeJob({ status: "COMPLETED" }); // already finished by a competing caller
    await runGalleyJob("job-1", null, { status: "QUEUED" });
    // Never re-fetched the article or ran generation — bailed out immediately.
    expect(fakeDb.article.findUnique).not.toHaveBeenCalled();
    expect(galleyJobStore["job-1"].status).toBe("COMPLETED");
  });

  test("an unconditional claim (empty claimFilter) always proceeds regardless of current status", async () => {
    makeJob({ status: "FAILED", errorMessage: "previous failure" });
    await runGalleyJob("job-1");
    expect(galleyJobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("runGalleyJob — manuscript source resolution", () => {
  test("uses getObject() for a real inputKey", async () => {
    makeJob({ inputKey: "manuscripts/real.docx" });
    await runGalleyJob("job-1");
    expect(galleyJobStore["job-1"].status).toBe("COMPLETED");
  });

  test("synthesises markdown for a synthesised/ inputKey without calling storage", async () => {
    makeJob({ inputKey: "synthesised/article-1.md" });
    getObjectResult = null; // storage would return nothing for a synthesised key anyway
    await runGalleyJob("job-1");
    expect(galleyJobStore["job-1"].status).toBe("COMPLETED");
  });

  test("falls back to synthesised markdown when the stored manuscript is missing", async () => {
    makeJob({ inputKey: "manuscripts/missing.docx" });
    getObjectResult = null;
    await runGalleyJob("job-1");
    expect(galleyJobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("sweepStuckGalleyJobs", () => {
  test("retries a QUEUED job and a stale-PROCESSING job, ignoring a fresh PROCESSING one", async () => {
    makeJob({ id: "queued-1", status: "QUEUED" });
    makeJob({ id: "stale-1", status: "PROCESSING", startedAt: new Date(Date.now() - 20 * 60 * 1000) });
    makeJob({ id: "fresh-1", status: "PROCESSING", startedAt: new Date() });

    const result = await sweepStuckGalleyJobs(5, 10);

    expect(result.swept).toBe(2);
    expect(result.jobIds.sort()).toEqual(["queued-1", "stale-1"].sort());
    expect(galleyJobStore["queued-1"].status).toBe("COMPLETED");
    expect(galleyJobStore["stale-1"].status).toBe("COMPLETED");
    expect(galleyJobStore["fresh-1"].status).toBe("PROCESSING");
  });

  test("respects the batch limit", async () => {
    for (let i = 0; i < 8; i++) makeJob({ id: `job-${i}`, status: "QUEUED" });
    const result = await sweepStuckGalleyJobs(3, 10);
    expect(result.swept).toBe(3);
  });
});
