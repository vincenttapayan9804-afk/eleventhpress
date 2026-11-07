import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PORTAL_COOKIE_NAME } from "@/lib/tenant";

/**
 * GET /t/<slug> — a whitelabel tenant's public portal link on the official
 * site. Remembers the tenant in a cookie and opens its branded platform
 * (home page, articles, sign-in and registration all belong to that tenant
 * from then on). GET /t/exit returns to the official Eleventh Press site.
 * A tenant with its own verified domain is reachable there too; this link
 * works without any DNS setup.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Same-site paths only ("//host" or "/\\host" would leave the site).
  const requested = req.nextUrl.searchParams.get("next") ?? "/";
  const safe = /^\/(?![\/\\])[^\s]*$/.test(requested) && !requested.startsWith("/t/") ? requested : "/";
  const next = new URL(safe, req.url);
  if (next.origin !== new URL(req.url).origin) next.href = new URL("/", req.url).href;
  const res = NextResponse.redirect(next);
  res.headers.set("Cache-Control", "private, no-store");

  if (slug === "exit") {
    res.cookies.set(PORTAL_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }

  const tenant = await db.tenant
    .findUnique({ where: { slug: slug.toLowerCase() }, select: { slug: true, status: true, isPlatform: true } })
    .catch(() => null);
  if (!tenant || tenant.isPlatform || tenant.status !== "ACTIVE") {
    res.cookies.set(PORTAL_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }

  res.cookies.set(PORTAL_COOKIE_NAME, tenant.slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
