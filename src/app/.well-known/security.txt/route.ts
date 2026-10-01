import { NextResponse } from "next/server";
import { APP_BASE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * RFC 9116 — /.well-known/security.txt. A dynamic route rather than a
 * static public/ file for the same reason robots.ts already is (see its
 * own doc comment): a static file can't reference APP_BASE_URL, so a
 * self-hosted deployment on a custom domain would otherwise ship a
 * Canonical field pointing at the wrong host.
 *
 * Contact reuses editorial@eleventhpress.org — the one real, monitored
 * address already used everywhere this codebase identifies itself to an
 * external service (Crossref, OpenAlex, COUNTER/SUSHI, ...), rather than
 * inventing a security@ alias nobody's actually watching yet.
 */
export async function GET() {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const body = [
    "Contact: mailto:editorial@eleventhpress.org",
    `Expires: ${expires.toISOString()}`,
    `Canonical: ${APP_BASE_URL}/.well-known/security.txt`,
    "Preferred-Languages: en",
  ].join("\n") + "\n";

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
