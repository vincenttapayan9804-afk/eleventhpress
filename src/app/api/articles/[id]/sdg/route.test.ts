import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/auth";

/**
 * Editor confirmation of an article's UN SDGs. Mocks delegate to the real
 * database module unless this file switched them on.
 */
type DbModule = typeof import("@/lib/db");
const REAL_DB = "../../../../../lib/db.ts?real=sdg-route-test";
const realDb = (await import(REAL_DB)) as DbModule;

let active = false;
let article: any;
let audits: any[] = [];

const articleMock = {
  findUnique: async ({ where }: any) => (article && where.id === article.id ? { ...article, journal: { tenantId: null } } : null),
  update: async ({ data }: any) => {
    article = { ...article, ...data };
    return { ...article };
  },
};

mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (active) {
        if (prop === "article") return articleMock;
        if (prop === "auditLog") return { create: async ({ data }: any) => audits.push(data) };
        if (prop === "$transaction") {
          return async (fn: any) => fn({ $executeRaw: async () => 0, article: articleMock });
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { POST } = await import("./route");

function req(body: unknown, role?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (role) {
    headers.authorization = `Bearer ${signToken({ userId: "u1", email: "e@example.org", role, fullName: "Ed" })}`;
  }
  return new NextRequest("http://localhost/api/articles/a1/sdg", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: "a1" }) };

beforeEach(() => {
  active = true;
  audits = [];
  article = { id: "a1", sdgGoals: JSON.stringify([13]), sdgStatus: "PROPOSED" };
});
afterAll(() => {
  active = false;
});

describe("POST /api/articles/[id]/sdg", () => {
  test("requires sign-in and an editor role", async () => {
    expect((await POST(req({ goals: [4] }), params)).status).toBe(401);
    expect((await POST(req({ goals: [4] }, "AUTHOR"), params)).status).toBe(403);
    expect(article.sdgStatus).toBe("PROPOSED");
  });

  test("rejects a body without a goal list", async () => {
    expect((await POST(req({ goals: "13" }, "EDITOR"), params)).status).toBe(400);
    expect((await POST(req("not json", "EDITOR"), params)).status).toBe(400);
  });

  test("confirms cleaned goals and records who changed what", async () => {
    const res = await POST(req({ goals: [4, 4, 99, "13", 6, 7] }, "EDITOR"), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sdgGoals).toEqual([4, 13, 6]);
    expect(json.sdgStatus).toBe("CONFIRMED");
    expect(article.sdgConfirmedById).toBe("u1");
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("SDG_CONFIRMED");
    expect(JSON.parse(audits[0].metadata)).toEqual({ before: { status: "PROPOSED", goals: [13] }, after: [4, 13, 6] });
  });

  test("an empty list records that no goal applies", async () => {
    const json = await (await POST(req({ goals: [] }, "ASSOCIATE_EDITOR"), params)).json();
    expect(json).toMatchObject({ sdgGoals: [], sdgStatus: "CONFIRMED" });
  });

  test("404 for an unknown article", async () => {
    article = null;
    expect((await POST(req({ goals: [1] }, "EDITOR"), params)).status).toBe(404);
  });
});
