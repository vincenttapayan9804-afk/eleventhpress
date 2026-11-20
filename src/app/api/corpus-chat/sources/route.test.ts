import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

/** bun's mock.module() registry is shared across files: the mock delegates unless switched on. */
type DbModule = typeof import("@/lib/db");
type RateLimitModule = typeof import("@/lib/ratelimit");
const REAL_DB = "../../../../lib/db.ts?real=corpus-sources-route-test";
const REAL_RATELIMIT = "../../../../lib/ratelimit.ts?real=corpus-sources-route-test";
const realDb = (await import(REAL_DB)) as DbModule;
const realRateLimit = (await import(REAL_RATELIMIT)) as RateLimitModule;

let active = false;
let articleWheres: any[] = [];
const ARTICLE = {
  id: "art_1",
  title: "Coastal Adaptation in Practice",
  authors: JSON.stringify([{ name: "Ana Rivera" }, { name: "Ben Cruz" }]),
  doi: null,
  publishedAt: new Date("2026-03-10T00:00:00Z"),
  anonymizedReviewHistory: false,
  journal: { name: "Journal of Test Studies", issn: "1234-5678" },
  issue: { volume: 4, issueNumber: 2, year: 2026 },
};

mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (!active) return Reflect.get(target, prop, receiver);
      if (prop === "article") {
        return {
          findMany: async (args: any) => {
            articleWheres.push(args.where);
            return args.where.id.in.includes(ARTICLE.id) ? [ARTICLE] : [];
          },
        };
      }
      if (prop === "journal") return { findFirst: async () => ({ name: "Journal of Test Studies", issn: "1234-5678", publisher: "Test Press" }) };
      if (prop === "tenantDomain") return { findFirst: async () => null };
      if (prop === "tenant") return { findFirst: async () => null, findUnique: async () => null };
      if (prop === "correction") return { findMany: async () => [{ articleId: "art_1", type: "RETRACTION", title: "Retraction", doi: null, issuedAt: new Date("2026-06-01T00:00:00Z") }] };
      if (prop === "retractionWatchSyncMeta") return { findUnique: async () => null };
      if (prop === "independentReview") return { findMany: async () => [] };
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

mock.module("@/lib/ratelimit", () => ({
  ...realRateLimit,
  checkRateLimit: async (...args: Parameters<RateLimitModule["checkRateLimit"]>) =>
    active ? { ok: true, mode: "simulation" as const, message: "" } : realRateLimit.checkRateLimit(...args),
}));

const { GET } = await import("./route");

let ip = 0;
function get(qs: string) {
  ip++;
  return GET(new NextRequest(`http://localhost/api/corpus-chat/sources?${qs}`, { headers: { "x-forwarded-for": `198.51.100.${ip}` } }));
}

const consoleWarn = console.warn;
beforeEach(() => {
  active = true;
  articleWheres = [];
  console.warn = () => {};
});
afterAll(() => {
  active = false;
  console.warn = consoleWarn;
});

describe("GET /api/corpus-chat/sources", () => {
  test("returns signals and the reference in the chosen style, for published articles only", async () => {
    const res = await get("ids=art_1,art_missing&style=mla");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.style).toBe("mla");
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]).toMatchObject({ articleId: "art_1", status: "retracted", retractedReferences: null, citations: null });
    expect(body.sources[0].reference).toContain("Rivera");
    expect(body.sources[0].reference).toContain("Coastal Adaptation in Practice");
    expect(articleWheres[0].status).toBe("PUBLISHED");
  });

  test("APA comes with the answer, so no reference is rebuilt; unknown styles fall back to APA", async () => {
    const body = await (await get("ids=art_1&style=nonsense")).json();
    expect(body.style).toBe("apa");
    expect(body.sources[0].reference).toBeNull();
  });

  test("ids are required", async () => {
    expect((await get("ids=")).status).toBe(400);
  });
});
