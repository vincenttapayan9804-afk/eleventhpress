/// <reference types="bun-types" />
/**
 * Article provenance sealing/verification (src/lib/article-provenance-server.ts).
 * Reproduces the production "Verification failed — hash mismatch" bug: a
 * seal taken at publish was invalidated by the platform's own later updates
 * (Zenodo DOI assignment, EPUB/galley regeneration). Resealing on those
 * paths must keep the record verifying, while a genuine out-of-band edit
 * must still fail, and a storage outage must never read as tampering.
 */
import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import * as realDbModule from "@/lib/db";
import * as realStorage from "@/lib/storage";

let article: any;
let storage: Record<string, Buffer>;
let audit: any[];
// bun's mock.module is process-wide: outside this file's tests every call
// falls through to the real modules so other test files are unaffected.
let active = false;

const fakeTables: Record<string, any> = {
  article: {
    findUnique: async () => (article ? { ...article } : null),
    update: async ({ data }: any) => {
      article = { ...article, ...data };
      return article;
    },
  },
  auditLog: { create: async ({ data }: any) => audit.push(data) },
};

mock.module("@/lib/db", () => ({
  ...realDbModule,
  db: new Proxy(realDbModule.db, {
    get: (target, prop) => (active && typeof prop === "string" && prop in fakeTables ? fakeTables[prop] : Reflect.get(target, prop)),
  }),
}));
mock.module("@/lib/storage", () => ({
  ...realStorage,
  getObject: async (key: string) => (active ? storage[key] ?? null : realStorage.getObject(key)),
}));

const { sealArticleProvenance, verifyArticleProvenance } = await import("./article-provenance-server");
const { PROVENANCE_SEAL_VERSION } = await import("./article-provenance");

async function verify() {
  return verifyArticleProvenance(article);
}

afterAll(() => {
  active = false;
});

beforeEach(() => {
  active = true;
  audit = [];
  storage = { "galleys/a.pdf": Buffer.from("pdf-v1") };
  article = {
    id: "art_1",
    status: "PUBLISHED",
    title: "Classroom Learning Environment",
    authors: JSON.stringify([{ name: "Lyn Hinampas" }]),
    abstract: "Abstract.",
    doi: null,
    publishedAt: new Date("2026-07-14T00:00:00Z"),
    contentType: "RESEARCH",
    discipline: "Education",
    insightCategory: null,
    keyTakeaways: null,
    galleyPdfKey: "galleys/a.pdf",
    galleyEpubKey: null,
    contentHash: null,
    galleyPdfHash: null,
    galleyEpubHash: null,
    provenanceVersion: 0,
    provenanceSealedAt: null,
  };
});

describe("article provenance", () => {
  test("a freshly sealed article verifies", async () => {
    await sealArticleProvenance("art_1", "publish");
    expect(article.provenanceVersion).toBe(PROVENANCE_SEAL_VERSION);
    expect((await verify()).verdict).toBe("verified");
  });

  test("DOI assignment after publish: stale seal mismatches, reseal fixes it", async () => {
    await sealArticleProvenance("art_1", "publish");
    article.doi = "10.5072/zenodo.564914";
    expect((await verify()).verdict).toBe("mismatch");
    await sealArticleProvenance("art_1", "doi-assigned");
    expect((await verify()).verdict).toBe("verified");
    expect(audit.at(-1).metadata).toContain("doi-assigned");
  });

  test("EPUB generated after publish: reseal covers the new galley", async () => {
    await sealArticleProvenance("art_1", "publish");
    storage["galleys/a.epub"] = Buffer.from("epub");
    article.galleyEpubKey = "galleys/a.epub";
    expect((await verify()).verdict).toBe("mismatch");
    await sealArticleProvenance("art_1", "galleys-regenerated");
    expect(article.galleyEpubHash).not.toBeNull();
    expect((await verify()).verdict).toBe("verified");
  });

  test("an out-of-band edit with no reseal still fails verification", async () => {
    await sealArticleProvenance("art_1", "publish");
    article.title = "Tampered title";
    expect((await verify()).verdict).toBe("mismatch");
    storage["galleys/a.pdf"] = Buffer.from("pdf-tampered");
    article.title = "Classroom Learning Environment";
    expect((await verify()).verdict).toBe("mismatch");
  });

  test("unreadable galley reports 'unavailable', never 'mismatch', and is never sealed", async () => {
    await sealArticleProvenance("art_1", "publish");
    delete storage["galleys/a.pdf"];
    const result = await verify();
    expect(result.verdict).toBe("unavailable");
    expect(result.unavailable).toEqual(["PDF"]);
    await expect(sealArticleProvenance("art_1", "backfill")).rejects.toThrow(/unreadable/);
  });

  test("resealing an unchanged, current seal is a no-op", async () => {
    await sealArticleProvenance("art_1", "publish");
    const before = audit.length;
    await sealArticleProvenance("art_1", "backfill");
    expect(audit.length).toBe(before);
  });

  test("unpublished articles are never sealed", async () => {
    article.status = "UNDER_REVIEW";
    expect(await sealArticleProvenance("art_1", "publish")).toBeNull();
    expect(article.contentHash).toBeNull();
  });
});
