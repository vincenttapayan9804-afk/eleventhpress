/// <reference types="bun-types" />
/**
 * Tests for the Book production pipeline (src/lib/book-production.ts).
 * buildEpub/buildBookPdf are exercised directly against real output;
 * runBookProductionJob/sweepStuckBookProductionJobs are exercised against
 * a hand-rolled in-memory store, mirroring galley-job.smoke.test.ts's
 * mocking pattern — same durability properties matter here: a failed job
 * never gets silently lost, and the atomic claim prevents double-processing.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

// Deliberately does NOT mock "@/lib/galley" — bun:test's mock.module is
// global per process, and galley-job.smoke.test.ts already mocks that same
// path with a different, incompatible shape (only generateGalleys). Two
// files mocking the same module path differently race depending on run
// order. escapeXml/htmlToPlainText/extractManuscriptBody/renderMinimalErrorPdf
// are pure/local (no DB or network access), so using the real
// implementations here is both safe and avoids the collision entirely.

const BOOK = {
  id: "book-1",
  title: "Collected Essays on Number Theory",
  subtitle: "A Compilation",
  authors: JSON.stringify([{ name: "Ada Lovelace" }, { name: "Alan Turing" }]),
  description: "A compiled volume.",
  format: "ANTHOLOGY",
  manuscriptKey: null as string | null,
};

let bookStore: Record<string, any> = {};
let bookArticleRows: any[] = [];
let jobStore: Record<string, any> = {};
let auditLogCalls: any[] = [];
let getObjectResult: Buffer | null = Buffer.from("<body><p>Chapter body</p></body>", "utf-8");

const fakeDb = {
  book: {
    findUnique: mock(async ({ where }: any) => bookStore[where.id] || null),
    update: mock(async ({ where, data }: any) => {
      Object.assign(bookStore[where.id], data);
      return bookStore[where.id];
    }),
  },
  bookArticle: {
    findMany: mock(async ({ where }: any) => bookArticleRows.filter((r) => r.bookId === where.bookId)),
  },
  bookProductionJob: {
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
  getObject: mock(async () => getObjectResult),
  putObject: mock(async () => ({})),
}));

const { buildEpub, buildBookPdf, runBookProductionJob, sweepStuckBookProductionJobs } = await import("@/lib/book-production");

function resetAll() {
  bookStore = { [BOOK.id]: { ...BOOK } };
  bookArticleRows = [
    { bookId: BOOK.id, chapterOrder: 0, article: { title: "Chapter One", abstract: "Abstract one", galleyHtmlKey: "published-galleys/a1.html" } },
    { bookId: BOOK.id, chapterOrder: 1, article: { title: "Chapter Two", abstract: "Abstract two", galleyHtmlKey: "published-galleys/a2.html" } },
  ];
  jobStore = {};
  auditLogCalls = [];
  getObjectResult = Buffer.from("<body><p>Chapter body</p></body>", "utf-8");
  for (const fn of Object.values(fakeDb.book)) (fn as any).mockClear?.();
  for (const fn of Object.values(fakeDb.bookArticle)) (fn as any).mockClear?.();
  for (const fn of Object.values(fakeDb.bookProductionJob)) (fn as any).mockClear?.();
  fakeDb.auditLog.create.mockClear();
}
beforeEach(resetAll);

function makeJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job-1",
    bookId: BOOK.id,
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

describe("buildEpub", () => {
  test("produces a valid ZIP with mimetype first, a chapter per input, and escaped titles", () => {
    const zip = buildEpub(BOOK, [
      { title: "Chapter <One>", html: "<p>Body</p>" },
      { title: "Chapter Two", html: "<p>More body</p>" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50); // local file header
    const text = zip.toString("latin1");
    expect(text).toContain("application/epub+zip");
    expect(text).toContain("Chapter &lt;One&gt;");
    expect(text).toContain("OEBPS/chapter-1.xhtml");
    expect(text).toContain("OEBPS/chapter-2.xhtml");
    expect(text).toContain("OEBPS/content.opf");
    expect(text).toContain("OEBPS/nav.xhtml");
    expect(text).toContain("META-INF/container.xml");
  });
});

describe("buildBookPdf", () => {
  test("resolves to a real, non-empty PDF buffer", async () => {
    const pdf = await buildBookPdf(BOOK, [{ title: "Chapter One", html: "<p>Some content</p>" }]);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

describe("runBookProductionJob — happy path (ANTHOLOGY)", () => {
  test("compiles chapters from linked articles' galleyHtmlKey, writes epub+pdf keys, and logs an audit entry", async () => {
    makeJob();
    await runBookProductionJob("job-1", "user-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
    expect(jobStore["job-1"].epubKey).toBe(`published-galleys/book-${BOOK.id}.epub`);
    expect(bookStore[BOOK.id].epubKey).toBe(`published-galleys/book-${BOOK.id}.epub`);
    expect(bookStore[BOOK.id].pdfKey).toBe(`published-galleys/book-${BOOK.id}.pdf`);
    expect(auditLogCalls.length).toBe(1);
    expect(auditLogCalls[0].data.action).toBe("BOOK_PRODUCED");
  });
});

describe("runBookProductionJob — MONOGRAPH uses the manuscript, not linked articles", () => {
  test("extracts the manuscript body via extractManuscriptBody", async () => {
    bookStore[BOOK.id].format = "MONOGRAPH";
    bookStore[BOOK.id].manuscriptKey = "book-manuscripts/x.md";
    getObjectResult = Buffer.from("Real manuscript text", "utf-8");
    makeJob();
    await runBookProductionJob("job-1");
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("runBookProductionJob — failure never gets silently lost", () => {
  test("marks the job FAILED when the book no longer exists", async () => {
    makeJob({ bookId: "does-not-exist" });
    await runBookProductionJob("job-1");
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toBe("Book no longer exists");
  });
});

describe("runBookProductionJob — atomic claim prevents double-processing", () => {
  test("a claim that doesn't match claimFilter is a no-op", async () => {
    makeJob({ status: "COMPLETED" });
    await runBookProductionJob("job-1", null, { status: "QUEUED" });
    expect(fakeDb.book.findUnique).not.toHaveBeenCalled();
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("sweepStuckBookProductionJobs", () => {
  test("retries QUEUED and stale-PROCESSING jobs, ignores fresh PROCESSING", async () => {
    makeJob({ id: "queued-1", status: "QUEUED" });
    makeJob({ id: "stale-1", status: "PROCESSING", startedAt: new Date(Date.now() - 20 * 60 * 1000) });
    makeJob({ id: "fresh-1", status: "PROCESSING", startedAt: new Date() });

    const result = await sweepStuckBookProductionJobs(5, 10);

    expect(result.swept).toBe(2);
    expect(jobStore["queued-1"].status).toBe("COMPLETED");
    expect(jobStore["stale-1"].status).toBe("COMPLETED");
    expect(jobStore["fresh-1"].status).toBe("PROCESSING");
  });
});
