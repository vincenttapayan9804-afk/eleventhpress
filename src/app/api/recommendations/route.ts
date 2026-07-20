import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { getRecommendationsForUser } from "@/lib/recommendations";

/**
 * GET /api/recommendations
 *
 * The logged-in reader's personalized "Recommended for you" digest
 * (src/lib/recommendations.ts) — requires a session since it's keyed on
 * the reader's own ReadingHistory. Returns an empty list (never a
 * fabricated "popular articles" substitute) once authenticated but with
 * no reading history yet.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const items = await getRecommendationsForUser(session.userId, 4);
  return NextResponse.json({ items });
}
