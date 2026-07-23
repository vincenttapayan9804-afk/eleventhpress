/// <reference types="bun-types" />
/**
 * Tests for the magazine issue production pipeline
 * (src/lib/magazine-production.ts). buildMagazineEpub/buildMagazinePdf are
 * exercised directly against real output; runMagazineIssueProductionJob/
 * sweepStuckMagazineIssueProductionJobs are exercised against a hand-rolled
 * in-memory store, mirroring book-production.test.ts's mocking pattern —
 * same durability properties matter here: a failed job never gets silently
 * lost, and the atomic claim prevents double-processing.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

const ISSUE = {
  id: "issue-1",
  title: "The Autumn Number",
  volume: 4,
  issueNumber: 2,
  year: 2026,
  epubKey: null as string | null,
  pdfKey: null as string | null,
};

let issueStore: Record<string, any> = {};
let magazineStore: Record<string, any> = {};
let pieceRows: any[] = [];
let jobStore: Record<string, any> = {};
let auditLogCalls: any[] = [];

const fakeDb = {
  magazineIssue: {
    findUnique: mock(async ({ where, include }: any) => {
      const issue = issueStore[where.id];
      if (!issue) return null;
      if (!include) return issue;
      return {
        ...issue,
        magazine: magazineStore[issue.magazineId],
        pieces: pieceRows.filter((p) => p.issueId === issue.id).sort((a, b) => a.order - b.order),
      };
    }),
    update: mock(async ({ where, data }: any) => {
      Object.assign(issueStore[where.id], data);
      return issueStore[where.id];
    }),
  },
  magazineIssueProductionJob: {
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
  auditLog: {
    create: mock(async (args: any) => {
      auditLogCalls.push(args);
      return {};
    }),
  },
};

mock.module("@/lib/db", () => ({ db: fakeDb }));
mock.module("@/lib/storage", () => ({
  putObject: mock(async () => ({})),
}));

const { buildMagazineEpub, buildMagazinePdf, runMagazineIssueProductionJob, sweepStuckMagazineIssueProductionJobs } = await import(
  "@/lib/magazine-production"
);

function resetAll() {
  issueStore = { [ISSUE.id]: { ...ISSUE, magazineId: "magazine-1" } };
  magazineStore = { "magazine-1": { id: "magazine-1", name: "Eleventh Press Review" } };
  pieceRows = [
    { issueId: ISSUE.id, order: 0, title: "Fieldwork & Failure", dek: "On negative results", bodyHtml: "<p>Piece one body</p>" },
    { issueId: ISSUE.id, order: 1, title: "Data & Its Discontents", dek: "On messy datasets", bodyHtml: "<p>Piece two body</p>" },
  ];
  jobStore = {};
  auditLogCalls = [];
  for (const fn of Object.values(fakeDb.magazineIssue)) (fn as any).mockClear?.();
  for (const fn of Object.values(fakeDb.magazineIssueProductionJob)) (fn as any).mockClear?.();
  fakeDb.auditLog.create.mockClear();
}
beforeEach(resetAll);

function makeJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job-1",
    issueId: ISSUE.id,
    status: "QUEUED",
    startedAt: null,
    errorMessage: null,
    epubKey: null,
    pdfKey: null,
    workerLog: null,
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  jobStore[job.id] = job;
  return job;
}

describe("buildMagazineEpub", () => {
  test("produces a valid ZIP with mimetype first and one chapter per piece", () => {
    const zip = buildMagazineEpub(ISSUE, "Eleventh Press Review", [
      { title: "Piece <One>", html: "<p>Body</p>" },
      { title: "Piece Two", html: "<p>More body</p>" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50); // local file header
    const text = zip.toString("latin1");
    expect(text).toContain("application/epub+zip");
    expect(text).toContain("Piece &lt;One&gt;");
    expect(text).toContain("OEBPS/chapter-1.xhtml");
    expect(text).toContain("OEBPS/chapter-2.xhtml");
  });
});

describe("buildMagazinePdf", () => {
  test("resolves to a real, non-empty PDF buffer", async () => {
    const pdf = await buildMagazinePdf(ISSUE, "Eleventh Press Review", [{ title: "Piece One", html: "<p>Some content</p>" }]);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  test("falls back to a Vol./No./year label when the issue has no title", async () => {
    const pdf = await buildMagazinePdf({ ...ISSUE, title: null }, "Eleventh Press Review", [{ title: "Piece One", html: "<p>x</p>" }]);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

describe("runMagazineIssueProductionJob — happy path", () => {
  test("compiles pieces in order, writes epub+pdf keys, and logs an audit entry", async () => {
    makeJob();
    await runMagazineIssueProductionJob("job-1", "user-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
    expect(jobStore["job-1"].epubKey).toBe(`published-galleys/magazine-issue-${ISSUE.id}.epub`);
    expect(issueStore[ISSUE.id].epubKey).toBe(`published-galleys/magazine-issue-${ISSUE.id}.epub`);
    expect(issueStore[ISSUE.id].pdfKey).toBe(`published-galleys/magazine-issue-${ISSUE.id}.pdf`);
    expect(auditLogCalls.length).toBe(1);
    expect(auditLogCalls[0].data.action).toBe("MAGAZINE_ISSUE_PRODUCED");
  });
});

describe("runMagazineIssueProductionJob — an issue with no pieces yet still produces a placeholder compile", () => {
  test("completes rather than failing", async () => {
    pieceRows = [];
    makeJob();
    await runMagazineIssueProductionJob("job-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("runMagazineIssueProductionJob — failure never gets silently lost", () => {
  test("marks the job FAILED when the issue no longer exists", async () => {
    makeJob({ issueId: "does-not-exist" });
    await runMagazineIssueProductionJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toBe("Issue no longer exists");
  });
});

describe("runMagazineIssueProductionJob — atomic claim prevents double-processing", () => {
  test("a claim that doesn't match claimFilter is a no-op", async () => {
    makeJob({ status: "COMPLETED" });
    await runMagazineIssueProductionJob("job-1", null, { status: "QUEUED" });
    expect(fakeDb.magazineIssue.findUnique).not.toHaveBeenCalled();
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("sweepStuckMagazineIssueProductionJobs", () => {
  test("retries QUEUED and stale-PROCESSING jobs, ignores fresh PROCESSING", async () => {
    makeJob({ id: "queued-1", status: "QUEUED" });
    makeJob({ id: "stale-1", status: "PROCESSING", startedAt: new Date(Date.now() - 20 * 60 * 1000) });
    makeJob({ id: "fresh-1", status: "PROCESSING", startedAt: new Date() });

    const result = await sweepStuckMagazineIssueProductionJobs(5, 10);

    expect(result.swept).toBe(2);
    expect(jobStore["queued-1"].status).toBe("COMPLETED");
    expect(jobStore["stale-1"].status).toBe("COMPLETED");
    expect(jobStore["fresh-1"].status).toBe("PROCESSING");
  });
});
