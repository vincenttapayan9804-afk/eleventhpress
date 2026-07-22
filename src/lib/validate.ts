import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Shared runtime-validation helper for API route bodies. `zod` was already
 * a listed dependency but, before this, was only ever used in one file
 * (src/lib/certificate-globe-asset.ts) — every route parsed `req.json()`
 * with a plain `as {...}` type assertion, which TypeScript never checks
 * against the actual request at runtime. This closes that gap for the
 * highest-risk routes (auth, admin role changes, billing) without
 * requiring every one of this app's ~100+ routes to be rewritten at once.
 *
 * Returns the parsed, typed body on success, or writes a 400 JSON response
 * directly and returns null — callers do:
 *
 *   const body = await parseBody(req, schema);
 *   if (!body) return; // 400 already sent... but route handlers must
 *                       // return a NextResponse, so see the pattern below.
 *
 * Because Next's route handlers must return a Response, callers instead do:
 *
 *   const result = await parseBody(req, schema);
 *   if (!result.ok) return result.response;
 *   const body = result.data;
 */
export type ParseBodyResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<ParseBodyResult<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request body";
    return { ok: false, response: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { ok: true, data: result.data };
}
