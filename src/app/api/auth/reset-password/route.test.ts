import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword, signPasswordResetToken } from "@/lib/auth";

/**
 * "Forgot password" end to end: request a link (same response whether or
 * not the account exists), check it, set a new password once.
 * Mocks delegate to the real modules unless this file switched them on.
 */
type DbModule = typeof import("@/lib/db");
type RateLimitModule = typeof import("@/lib/ratelimit");
type EmailModule = typeof import("@/lib/email");
type BreachModule = typeof import("@/lib/password-breach");
const REAL = {
  db: "../../../../lib/db.ts?real=reset-password-test",
  ratelimit: "../../../../lib/ratelimit.ts?real=reset-password-test",
  email: "../../../../lib/email.ts?real=reset-password-test",
  breach: "../../../../lib/password-breach.ts?real=reset-password-test",
};
const realDb = (await import(REAL.db)) as DbModule;
const realRateLimit = (await import(REAL.ratelimit)) as RateLimitModule;
const realEmail = (await import(REAL.email)) as EmailModule;
const realBreach = (await import(REAL.breach)) as BreachModule;

let active = false;
let user: any;
let sent: { to: string; subject: string; html: string }[] = [];
let audits: any[] = [];
let breached = false;

mock.module("@/lib/db", () => ({
  ...realDb,
  db: new Proxy(realDb.db as object, {
    get(target, prop, receiver) {
      if (active && prop === "user") {
        return {
          findUnique: async ({ where }: any) =>
            user && ((where.id && where.id === user.id) || (where.email && where.email === user.email)) ? { ...user } : null,
          update: async ({ data }: any) => {
            user = { ...user, ...data };
            return user;
          },
        };
      }
      if (active && prop === "auditLog") return { create: async ({ data }: any) => audits.push(data) };
      return Reflect.get(target, prop, receiver);
    },
  }),
}));
mock.module("@/lib/ratelimit", () => ({
  ...realRateLimit,
  checkRateLimit: (async (...args: Parameters<RateLimitModule["checkRateLimit"]>) =>
    active ? { ok: true } : realRateLimit.checkRateLimit(...args)) as unknown as RateLimitModule["checkRateLimit"],
}));
mock.module("@/lib/email", () => ({
  ...realEmail,
  sendEmail: (async (p: any) => {
    if (!active) return realEmail.sendEmail(p);
    sent.push(p);
    return { ok: true, mode: "live" };
  }) as EmailModule["sendEmail"],
}));
mock.module("@/lib/password-breach", () => ({
  ...realBreach,
  isPasswordBreached: (async (pw: string) => (active ? breached : realBreach.isPasswordBreached(pw))) as BreachModule["isPasswordBreached"],
}));

const forgot = await import("../forgot-password/route");
const reset = await import("./route");

let ip = 0;
const req = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++ip}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const quiet = { error: console.error, warn: console.warn };
beforeEach(() => {
  active = true;
  breached = false;
  sent = [];
  audits = [];
  user = {
    id: "u1",
    email: "admin@eleventhpress.org",
    fullName: "Eleanor <Vance>",
    passwordHash: hashPassword("old-password-123"),
    deletedAt: null,
    emailVerifiedAt: null,
    twoFactorEnabled: true,
    failedLoginCount: 7,
    lockedUntil: new Date(Date.now() + 60_000),
  };
  console.error = () => {};
  console.warn = () => {};
});
afterAll(() => {
  active = false;
  Object.assign(console, quiet);
});

describe("POST /api/auth/forgot-password", () => {
  test("emails a reset link to an existing account", async () => {
    const body = await (await forgot.POST(req("http://localhost/api/auth/forgot-password", { email: "admin@eleventhpress.org" }))).json();
    expect(body.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("admin@eleventhpress.org");
    expect(sent[0].html).toContain("/reset-password?token=");
    expect(sent[0].html).toContain("Eleanor &lt;Vance&gt;");
    expect(audits[0].action).toBe("PASSWORD_RESET_REQUESTED");
  });

  test("gives the identical response for an unknown email and sends nothing", async () => {
    const known = await (await forgot.POST(req("http://localhost/api/auth/forgot-password", { email: "admin@eleventhpress.org" }))).json();
    sent = [];
    const unknown = await (await forgot.POST(req("http://localhost/api/auth/forgot-password", { email: "nobody@example.org" }))).json();
    expect(unknown).toEqual(known);
    expect(sent).toHaveLength(0);
  });

  test("matches an email typed in a different case", async () => {
    await forgot.POST(req("http://localhost/api/auth/forgot-password", { email: "Admin@EleventhPress.org" }));
    expect(sent).toHaveLength(1);
  });

  test("never emails a deleted account", async () => {
    user.deletedAt = new Date();
    await forgot.POST(req("http://localhost/api/auth/forgot-password", { email: "admin@eleventhpress.org" }));
    expect(sent).toHaveLength(0);
  });
});

describe("/api/auth/reset-password", () => {
  const tokenFor = () => signPasswordResetToken(user.id, user.passwordHash);

  test("GET reports a valid link with a masked email", async () => {
    const body = await (await reset.GET(req(`http://localhost/api/auth/reset-password?token=${tokenFor()}`))).json();
    expect(body.valid).toBe(true);
    expect(body.email).toBe("ad***@eleventhpress.org");
  });

  test("POST sets the new password, clears the lockout, verifies the email and sends a notice", async () => {
    const res = await reset.POST(req("http://localhost/api/auth/reset-password", { token: tokenFor(), password: "a-brand-new-passphrase" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, twoFactorEnabled: true });
    expect(verifyPassword("a-brand-new-passphrase", user.passwordHash)).toBe(true);
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(audits.map((a) => a.action)).toContain("PASSWORD_RESET");
    expect(sent[0].subject).toMatch(/password was changed/i);
  });

  test("a link works only once", async () => {
    const token = tokenFor();
    await reset.POST(req("http://localhost/api/auth/reset-password", { token, password: "a-brand-new-passphrase" }));
    const again = await reset.POST(req("http://localhost/api/auth/reset-password", { token, password: "another-passphrase-9" }));
    expect(again.status).toBe(400);
    expect((await again.json()).invalidLink).toBe(true);
    expect(verifyPassword("a-brand-new-passphrase", user.passwordHash)).toBe(true);
    const check = await (await reset.GET(req(`http://localhost/api/auth/reset-password?token=${token}`))).json();
    expect(check.valid).toBe(false);
  });

  test("rejects a short or breached password without changing anything", async () => {
    const before = user.passwordHash;
    const short = await reset.POST(req("http://localhost/api/auth/reset-password", { token: tokenFor(), password: "short" }));
    expect(short.status).toBe(400);
    breached = true;
    const leaked = await reset.POST(req("http://localhost/api/auth/reset-password", { token: tokenFor(), password: "password123456" }));
    expect(leaked.status).toBe(400);
    expect((await leaked.json()).error).toMatch(/breach/);
    expect(user.passwordHash).toBe(before);
  });

  test("rejects a forged or garbage token", async () => {
    const res = await reset.POST(req("http://localhost/api/auth/reset-password", { token: "garbage", password: "a-brand-new-passphrase" }));
    expect(res.status).toBe(400);
  });
});
