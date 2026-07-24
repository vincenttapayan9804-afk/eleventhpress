/// <reference types="bun-types" />
/**
 * Tests for the Kokoro-82M narration pipeline (src/lib/kokoro-tts.ts).
 * kokoro-js itself is mocked (it needs real network egress to Hugging Face
 * Hub to load real weights, exactly like @xenova/transformers in
 * embeddings.test.ts/transcription's own tests) — these tests exercise the
 * job lifecycle, atomic-claim, and content-type resolution logic against a
 * hand-rolled in-memory store, mirroring magazine-production.test.ts.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let articleStore: Record<string, any> = {};
let pieceStore: Record<string, any> = {};
let postStore: Record<string, any> = {};
let jobStore: Record<string, any> = {};
let storageObjects: Record<string, Buffer> = {};
let auditLogCalls: any[] = [];
let putObjectCalls: any[] = [];

const fakeDb = {
  article: {
    findUnique: mock(async ({ where }: any) => articleStore[where.id] || null),
  },
  magazinePiece: {
    findUnique: mock(async ({ where }: any) => pieceStore[where.id] || null),
  },
  mediaPost: {
    findUnique: mock(async ({ where }: any) => postStore[where.id] || null),
  },
  narrationJob: {
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
  getObject: mock(async (key: string) => storageObjects[key] || null),
  putObject: mock(async (key: string, data: Buffer) => {
    putObjectCalls.push({ key, data });
    return { key, size: data.length, etag: "x" };
  }),
}));

// Two fixed 24kHz chunks (100 samples each) — enough to exercise
// concatenation + silence-gap math without needing real audio.
const CHUNK_A = new Float32Array(100).fill(0.1);
const CHUNK_B = new Float32Array(150).fill(0.2);

let modelAvailable = true;
class FakeTextSplitterStream {
  push(_text: string) {}
  close() {}
}
class FakeRawAudio {
  audio: Float32Array;
  sampling_rate: number;
  constructor(audio: Float32Array, sampling_rate: number) {
    this.audio = audio;
    this.sampling_rate = sampling_rate;
  }
  toWav() {
    // Real callers only care that this is a Buffer-able ArrayBuffer carrying
    // the real sample count through, so tests can assert on it.
    return new ArrayBuffer(this.audio.length);
  }
}
mock.module("kokoro-js", () => ({
  KokoroTTS: {
    from_pretrained: mock(async () => {
      if (!modelAvailable) return null;
      return {
        stream: async function* () {
          yield { audio: { audio: CHUNK_A, sampling_rate: 24000 } };
          yield { audio: { audio: CHUNK_B, sampling_rate: 24000 } };
        },
      };
    }),
  },
  TextSplitterStream: FakeTextSplitterStream,
}));
mock.module("@huggingface/transformers", () => ({
  RawAudio: FakeRawAudio,
}));

const {
  runNarrationJob,
  sweepStuckNarrationJobs,
  synthesizeNarration,
  htmlToPlainText,
  __resetKokoroTtsCacheForTests,
} = await import("@/lib/kokoro-tts");

function resetAll() {
  articleStore = {
    "article-1": {
      id: "article-1",
      status: "PUBLISHED",
      title: "On Negative Results",
      abstract: "A study of null findings.",
      galleyHtmlKey: "published-galleys/article-1.html",
    },
  };
  pieceStore = {
    "piece-1": {
      id: "piece-1",
      title: "Fieldwork & Failure",
      dek: "On negative results",
      bodyHtml: "<p>Piece body</p>",
      issue: { status: "PUBLISHED" },
    },
  };
  postStore = {
    "post-1": {
      id: "post-1",
      status: "PUBLISHED",
      title: "Announcing the Spring Issue",
      dek: "New voices, new work",
      bodyHtml: "<p>Post body</p>",
    },
  };
  storageObjects = {
    "published-galleys/article-1.html": Buffer.from(
      '<html><body><div class="article-body"><p>Real article content.</p></div></body></html>'
    ),
  };
  jobStore = {};
  auditLogCalls = [];
  putObjectCalls = [];
  modelAvailable = true;
  __resetKokoroTtsCacheForTests();
  for (const fn of Object.values(fakeDb.narrationJob)) (fn as any).mockClear?.();
  fakeDb.auditLog.create.mockClear();
}
beforeEach(resetAll);

function makeJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job-1",
    contentType: "ARTICLE",
    contentId: "article-1",
    status: "QUEUED",
    voice: "af_heart",
    audioKey: null,
    durationSec: null,
    wordCount: null,
    model: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdById: "user-1",
    createdAt: new Date(),
    ...overrides,
  };
  jobStore[job.id] = job;
  return job;
}

describe("htmlToPlainText", () => {
  test("strips tags and decodes common entities", () => {
    expect(htmlToPlainText('<p>Tom &amp; Jerry &mdash; a &quot;classic&quot;</p>')).toBe(
      'Tom & Jerry &mdash; a "classic"'
    );
  });

  test("collapses whitespace and trims", () => {
    expect(htmlToPlainText("<div>  <span>Hello</span>\n\n<span>World</span>  </div>")).toBe("Hello World");
  });
});

describe("synthesizeNarration", () => {
  test("concatenates streamed chunks with a silence gap and returns real duration/word count", async () => {
    const result = await synthesizeNarration("Title", "Some body text here.", "af_heart");
    expect(result).not.toBeNull();
    const gapSamples = Math.round(0.35 * 24000);
    const expectedSamples = CHUNK_A.length + gapSamples + CHUNK_B.length;
    expect(result!.durationSec).toBe(Math.round(expectedSamples / 24000));
    // FakeRawAudio.toWav() returns an ArrayBuffer sized 1:1 with sample count,
    // so the resulting buffer length is a direct proxy for "were all chunks
    // (plus the gap) really concatenated into one RawAudio before encoding".
    expect(result!.wavBuffer.length).toBe(expectedSamples);
    expect(result!.wordCount).toBeGreaterThan(0);
    expect(result!.model).toContain("Kokoro");
  });

  test("returns null when the local model can't load", async () => {
    modelAvailable = false;
    const result = await synthesizeNarration("Title", "Body", "af_heart");
    expect(result).toBeNull();
  });
});

describe("runNarrationJob — per content type", () => {
  test("ARTICLE: extracts body from the galley HTML div and completes", async () => {
    makeJob();
    await runNarrationJob("job-1", { status: "QUEUED" });
    expect(jobStore["job-1"].status).toBe("COMPLETED");
    expect(jobStore["job-1"].audioKey).toBe("narration-audio/article/article-1-af_heart.wav");
    expect(putObjectCalls.length).toBe(1);
    expect(putObjectCalls[0].key).toBe("narration-audio/article/article-1-af_heart.wav");
    expect(auditLogCalls[0].data.action).toBe("NARRATION_GENERATED");
  });

  test("MAGAZINE_PIECE: narrates dek + bodyHtml", async () => {
    makeJob({ id: "job-2", contentType: "MAGAZINE_PIECE", contentId: "piece-1" });
    await runNarrationJob("job-2", { status: "QUEUED" });
    expect(jobStore["job-2"].status).toBe("COMPLETED");
    expect(jobStore["job-2"].audioKey).toBe("narration-audio/magazine_piece/piece-1-af_heart.wav");
  });

  test("MEDIA_POST: narrates dek + bodyHtml", async () => {
    makeJob({ id: "job-3", contentType: "MEDIA_POST", contentId: "post-1" });
    await runNarrationJob("job-3", { status: "QUEUED" });
    expect(jobStore["job-3"].status).toBe("COMPLETED");
    expect(jobStore["job-3"].audioKey).toBe("narration-audio/media_post/post-1-af_heart.wav");
  });

  test("two personas for the same content item get distinct audioKeys (no overwrite)", async () => {
    makeJob({ id: "job-female", voice: "af_heart" });
    makeJob({ id: "job-male", voice: "am_adam" });
    await runNarrationJob("job-female", { status: "QUEUED" });
    await runNarrationJob("job-male", { status: "QUEUED" });
    expect(jobStore["job-female"].audioKey).toBe("narration-audio/article/article-1-af_heart.wav");
    expect(jobStore["job-male"].audioKey).toBe("narration-audio/article/article-1-am_adam.wav");
    expect(jobStore["job-female"].audioKey).not.toBe(jobStore["job-male"].audioKey);
  });
});

describe("runNarrationJob — failure is never silently lost", () => {
  test("FAILED with a real errorMessage when the article isn't published", async () => {
    articleStore["article-1"].status = "DRAFT";
    makeJob();
    await runNarrationJob("job-1", { status: "QUEUED" });
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toBe("Content not found or not published");
  });

  test("FAILED when the local model isn't available in this deployment", async () => {
    modelAvailable = false;
    makeJob();
    await runNarrationJob("job-1", { status: "QUEUED" });
    expect(jobStore["job-1"].status).toBe("FAILED");
    expect(jobStore["job-1"].errorMessage).toContain("not available");
  });
});

describe("runNarrationJob — atomic claim prevents double-processing", () => {
  test("a claim that doesn't match claimFilter is a no-op", async () => {
    makeJob({ status: "COMPLETED" });
    await runNarrationJob("job-1", { status: "QUEUED" });
    expect(fakeDb.narrationJob.findUnique).not.toHaveBeenCalled();
    expect(jobStore["job-1"].status).toBe("COMPLETED");
  });
});

describe("sweepStuckNarrationJobs", () => {
  test("retries QUEUED and stale-PROCESSING jobs, ignores fresh PROCESSING", async () => {
    makeJob({ id: "queued-1", status: "QUEUED" });
    makeJob({ id: "stale-1", status: "PROCESSING", startedAt: new Date(Date.now() - 30 * 60 * 1000) });
    makeJob({ id: "fresh-1", status: "PROCESSING", startedAt: new Date() });

    const result = await sweepStuckNarrationJobs(5, 20);

    expect(result.swept).toBe(2);
    expect(jobStore["queued-1"].status).toBe("COMPLETED");
    expect(jobStore["stale-1"].status).toBe("COMPLETED");
    expect(jobStore["fresh-1"].status).toBe("PROCESSING");
  });
});
