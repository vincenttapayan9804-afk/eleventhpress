import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { signToken } from "@/lib/auth";
import { tabsForRole, isPlatformContext } from "@/components/dashboard/dashboard-tabs";

/**
 * Only the main platform's super admin manages institutions (tenants): a
 * tenant's own admin, a super admin account inside a tenant, and any
 * request made from a whitelabel site are all refused, and the dashboard
 * never offers the Tenants tab on a tenant platform.
 * The db mock delegates to the real module unless this file switched it on.
 */
type DbModule = typeof import("@/lib/db");
const REAL_DB = "./db.ts?real=tenant-auth-test";
const realDb = (await import(REAL_DB)) as DbModule;

const PLATFORM = { id: "platform", slug: "eleventhpress", name: "Eleventh Press", status: "ACTIVE", isPlatform: true };
const RON = { id: "ron", slug: "ron", name: "Ron University", status: "ACTIVE", isPlatform: false };
const TENANTS = [PLATFORM, RON];
const DOMAINS = [
  { hostname: "eleventhpress.org", verified: true, tenant: PLATFORM },
  { hostname: "journal.ron.edu", verified: true, tenant: RON },
];

let active = false;
mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (active && prop === "tenant") {
        return {
          findUnique: async ({ where }: any) => TENANTS.find((t) => t.id === where.id || t.slug === where.slug) ?? null,
          findFirst: async ({ where }: any) => TENANTS.find((t) => t.isPlatform === where.isPlatform) ?? null,
        };
      }
      if (active && prop === "tenantDomain") {
        return { findFirst: async ({ where }: any) => DOMAINS.find((d) => d.hostname === where.hostname) ?? null };
      }
      return Reflect.get(target, prop, receiver);
    },
  }),
}));

const { requirePlatformSuperAdmin, PLATFORM_ONLY_ERROR } = await import("./tenant-auth");

beforeEach(() => {
  active = true;
});
afterAll(() => {
  active = false;
});

function headers(role: string, tenantId: string | undefined, host = "eleventhpress.org", cookie = ""): Headers {
  const token = signToken({ userId: "u1", email: "a@b.c", role, fullName: "A", ...(tenantId ? { tenantId } : {}) });
  return new Headers({ host, authorization: `Bearer ${token}`, ...(cookie ? { cookie } : {}) });
}

describe("requirePlatformSuperAdmin", () => {
  test("the platform's own super admin on the main site passes", async () => {
    expect((await requirePlatformSuperAdmin(headers("SUPER_ADMIN", "platform"))).ok).toBe(true);
    // Tokens signed before tenants existed carry no tenant: treated as the platform.
    expect((await requirePlatformSuperAdmin(headers("SUPER_ADMIN", undefined))).ok).toBe(true);
  });

  test("a tenant admin is refused", async () => {
    const r = await requirePlatformSuperAdmin(headers("TENANT_ADMIN", "ron"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  test("a super admin account that belongs to a tenant is refused", async () => {
    const r = await requirePlatformSuperAdmin(headers("SUPER_ADMIN", "ron"));
    expect(r).toEqual({ ok: false, status: 403, error: PLATFORM_ONLY_ERROR });
  });

  test("an account whose tenant can't be found is refused", async () => {
    expect((await requirePlatformSuperAdmin(headers("SUPER_ADMIN", "deleted"))).ok).toBe(false);
  });

  test("requests from a tenant's own domain or portal are refused, even for the platform super admin", async () => {
    expect((await requirePlatformSuperAdmin(headers("SUPER_ADMIN", "platform", "journal.ron.edu"))).ok).toBe(false);
    const { PORTAL_COOKIE_NAME } = await import("./tenant");
    expect(
      (await requirePlatformSuperAdmin(headers("SUPER_ADMIN", "platform", "eleventhpress.org", `${PORTAL_COOKIE_NAME}=ron`))).ok
    ).toBe(false);
  });

  test("signed out is 401", async () => {
    const r = await requirePlatformSuperAdmin(new Headers({ host: "eleventhpress.org" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});

describe("dashboard tabs", () => {
  const keys = (role: string, onPlatform: boolean) => tabsForRole(role, onPlatform).map((t) => t.key);

  test("Tenants is offered only to the platform super admin on the main site", () => {
    expect(keys("SUPER_ADMIN", true)).toContain("tenants");
    expect(keys("SUPER_ADMIN", false)).not.toContain("tenants");
    expect(keys("TENANT_ADMIN", true)).not.toContain("tenants");
    expect(keys("TENANT_ADMIN", false)).not.toContain("tenants");
  });

  test("a tenant admin keeps Departments on their own platform", () => {
    expect(keys("TENANT_ADMIN", false)).toContain("departments");
  });

  test("platform context: main site + platform account only", () => {
    const main = { isPlatform: true, tenantId: "platform" };
    const whitelabel = { isPlatform: false, tenantId: "ron" };
    expect(isPlatformContext(main, { workspace: { isPlatform: true } })).toBe(true);
    expect(isPlatformContext(main, { workspace: null })).toBe(true);
    expect(isPlatformContext(main, { workspace: { isPlatform: false } })).toBe(false);
    expect(isPlatformContext(whitelabel, { workspace: { isPlatform: true } })).toBe(false);
  });
});
