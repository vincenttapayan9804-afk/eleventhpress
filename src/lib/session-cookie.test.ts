import { describe, expect, test } from "bun:test";
import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromHeaders, setSessionCookie, signToken } from "./auth";
import { sessionCookieNameFor, sessionCookieNameForHeaders, validPortalSlug } from "./session-cookie";

const admin = signToken({ userId: "u-admin", email: "admin@example.org", role: "SUPER_ADMIN", fullName: "Admin" });
const ron = signToken({ userId: "u-ron", email: "ron@example.org", role: "TENANT_ADMIN", fullName: "Ron", tenantId: "t-ron" });

function req(cookies: Record<string, string>) {
  return new Headers({ cookie: Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ") });
}

describe("separate sign-ins for the official site and each tenant portal", () => {
  test("cookie names", () => {
    expect(sessionCookieNameFor(null)).toBe("epip_session");
    expect(sessionCookieNameFor("ron-publishing")).toBe("epip_session__ron-publishing");
    expect(sessionCookieNameFor("bad;slug")).toBe("epip_session");
    expect(validPortalSlug("Ron")).toBe("ron");
  });

  test("each site reads only its own sign-in", () => {
    const both = { epip_session: admin, "epip_session__ron": ron };
    expect(getSessionFromHeaders(req(both))?.userId).toBe("u-admin");
    expect(getSessionFromHeaders(req({ ...both, ep_portal: "ron" }))?.userId).toBe("u-ron");
    // The official site's sign-in never leaks into a portal.
    expect(getSessionFromHeaders(req({ epip_session: admin, ep_portal: "ron" }))).toBeNull();
    // A different portal has its own (empty) sign-in.
    expect(getSessionFromHeaders(req({ ...both, ep_portal: "acme" }))).toBeNull();
  });

  test("signing out of the official site leaves tenant portals signed in", () => {
    const res = NextResponse.json({});
    clearSessionCookie(res, req({ epip_session: admin, "epip_session__ron": ron }));
    expect(res.cookies.get("epip_session")?.value).toBe("");
    expect(res.cookies.get("epip_session__ron")).toBeUndefined();
  });

  test("signing out of a portal leaves the official site signed in", () => {
    const res = NextResponse.json({});
    const h = req({ epip_session: admin, "epip_session__ron": ron, ep_portal: "ron" });
    clearSessionCookie(res, h);
    expect(res.cookies.get("epip_session__ron")?.value).toBe("");
    expect(res.cookies.get("epip_session")).toBeUndefined();
  });

  test("signing in inside a portal writes only that portal's cookie", () => {
    const res = NextResponse.json({});
    const h = req({ ep_portal: "ron" });
    expect(sessionCookieNameForHeaders(h)).toBe("epip_session__ron");
    setSessionCookie(res, h, ron);
    expect(res.cookies.get("epip_session__ron")?.value).toBe(ron);
    expect(res.cookies.get("epip_session")).toBeUndefined();
  });
});
