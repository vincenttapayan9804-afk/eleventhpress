/// <reference types="bun-types" />
/**
 * Mocked smoke tests for the AltTextJob runner (src/lib/alt-text.ts),
 * mirroring galley-job.smoke.test.ts's shape: atomic claim, failure never
 * silently lost, and the honest heuristic-fallback-on-vision-failure path
 * (never a fabricated description).
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

const ARTICLE = {
  id: "article-1",
  title: "Test Article",
  galleyHtmlKey: "published-galleys/article-1.html",
};

let jobStore: Record<string, any> = {};
let galleyHtml = `<p>Intro</p><img src="published-galleys/fig1.png" alt="Original caption"><img src="published-galleys/fig2.png">`;
let describeImageShouldFail = false;
let auditLogCalls: any[] = [];

const fakeDb = {
  altTextJob: {
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
  getObject: mock(async (key: string) => {
    if (key === ARTICLE.galleyHtmlKey) return Buffer.from(galleyHtml, "utf-8");
    if (key.startsWith("published-galleys/fig")) return Buffer.from("fake-image-bytes");
    return null;
  }),
  putObject: mock(async () => ({})),
}));
mock.module("@/lib/llm", () => ({
  describeImage: mock(async () => {
    if (describeImageShouldFail) throw new Error("mock vision failure");
    return { altText: "A generated description of the figure.", model: "claude-sonnet-5" };
  }),
}));
mock.module("sharp", () => {
  const factory = (buf: Buffer) => {
    const instance: any = {
      resize: () => instance,
      toBuffer: async () => buf,
      metadata: async () => ({ format: "png" }),
    };
    return instance;
  };
  return { default: factory };
});

const { runAltTextJob, sweepStuckAltTextJobs } = await import("@/lib/alt-text");

function makeJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job-1",
    articleId: ARTICLE.id,
    status: "QUEUED",
    imagesFound: 0,
    imagesProcessed: 0,
    results: null,
    appliedAt: null,
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
  galleyHtml = `<p>Intro</p><img src="published-galleys/fig1.png" alt="Original caption"><img src="published-galleys/fig2.png">`;
  describeImageShouldFail = false;
  auditLogCalls = [];
  fakeDb.altTextJob.updateMany.mockClear();
  fakeDb.altTextJob.findUnique.mockClear();
  fakeDb.altTextJob.update.mockClear();
  fakeDb.altTextJob.findMany.mockClear();
  fakeDb.article.findUnique.mockClear();
  fakeDb.auditLog.create.mockClear();
}

beforeEach(resetAll);

describe("runAltTextJob — happy path", () => {
  test("finds every figure, generates a suggestion per image, and writes an audit log", async () => {
    makeJob();
    await runAltTextJob("job-1", "user-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
    expect(jobStore["job-1"].imagesFound).toBe(2);
    expect(jobStore["job-1"].imagesProcessed).toBe(2);
    const results = JSON.parse(jobStore["job-1"].results);
    expect(results).toHaveLength(2);
    expect(results[0].mode).toBe("llm");
    expect(results[0].suggestedAlt).toBe("A generated description of the figure.");
    expect(fakeDb.auditLog.create).toHaveBeenCalledTimes(1);
  });

  test("never touches the live galley HTML — only records suggestions", async () => {
    const { putObject } = await import("@/lib/storage");
    makeJob();
    await runAltTextJob("job-1");
    expect(putObject).not.toHaveBeenCalled();
  });
});

describe("runAltTextJob — honest fallback, never a fabricated description", () => {
  test("falls back to the existing caption when vision generation fails", async () => {
    makeJob();
    describeImageShouldFail = true;
    await runAltTextJob("job-1");
    const results = JSON.parse(jobStore["job-1"].results);
    const fig1 = results.find((r: any) => r.src === "published-galleys/fig1.png");
    expect(fig1.mode).toBe("heuristic");
    expect(fig1.suggestedAlt).toBe("Original caption");
  });

  test("falls back to a generic 'Figure from {title}' when there's no existing caption either", async () => {
    makeJob();
    describeImageShouldFail = true;
    await runAltTextJob("job-1");
    const results = JSON.parse(jobStore["job-1"].results);
    const fig2 = results.find((r: any) => r.src === "published-galleys/fig2.png");
    expect(fig2.mode).toBe("heuristic");
    expect(fig2.suggestedAlt).toBe(`Figure from ${ARTICLE.title}`);
  });
});

describe("runAltTextJob — failure never gets silently lost", () => {
  test("marks the job FAILED when the article has no galley HTML", async () => {
    makeJob();
    galleyHtml = "";
    const { getObject } = await import("@/lib/storage");
    (getObject as any).mockImplementationOnce(async () => null);
    await runAltTextJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toContain("no galley HTML");
  });

  test("marks the job FAILED when the article no longer exists", async () => {
    makeJob({ articleId: "does-not-exist" });
    await runAltTextJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toBe("Article no longer exists");
  });
});

describe("runAltTextJob — atomic claim prevents double-processing", () => {
  test("a claim that doesn't match claimFilter is a no-op", async () => {
    makeJob({ status: "COMPLETED" });
    await runAltTextJob("job-1", null, { status: "QUEUED" });
    expect(fakeDb.article.findUnique).not.toHaveBeenCalled();
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("sweepStuckAltTextJobs", () => {
  test("retries a QUEUED job and a stale-PROCESSING job, ignoring a fresh PROCESSING one", async () => {
    makeJob({ id: "queued-1", status: "QUEUED" });
    makeJob({ id: "stale-1", status: "PROCESSING", startedAt: new Date(Date.now() - 20 * 60 * 1000) });
    makeJob({ id: "fresh-1", status: "PROCESSING", startedAt: new Date() });

    const result = await sweepStuckAltTextJobs(5, 10);

    expect(result.swept).toBe(2);
    expect(jobStore["queued-1"].status).toBe("COMPLETED");
    expect(jobStore["stale-1"].status).toBe("COMPLETED");
    expect(jobStore["fresh-1"].status).toBe("PROCESSING");
  });
});
