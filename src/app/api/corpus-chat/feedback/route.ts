import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractRequestIp } from "@/lib/institutions";
import { checkRateLimit } from "@/lib/ratelimit";
import { notifyMany } from "@/lib/notify";
import { cleanSourceIds } from "@/lib/research-query";

/**
 * POST /api/corpus-chat/feedback — "Helpful", "Not helpful" and "Report
 * issue" on a Research Assistant answer.
 *
 * Stores the question, the answer and the cited article ids so editors can
 * see exactly what was said; no IP address is stored, and the reader's
 * account only when they were signed in. An issue report also notifies
 * the journal's editors.
 */
const RATINGS = new Set(["HELPFUL", "NOT_HELPFUL", "ISSUE"]);
const ISSUE_TYPES = new Set(["INACCURATE", "WRONG_CITATION", "MISSING_INFORMATION", "WRONG_ARTICLE", "OTHER"]);
const ISSUE_LABELS: Record<string, string> = {
  INACCURATE: "Inaccurate information",
  WRONG_CITATION: "Citation doesn't support the claim",
  MISSING_INFORMATION: "Missing or incomplete information",
  WRONG_ARTICLE: "Answer is about the wrong article",
  OTHER: "Other",
};

export async function POST(req: NextRequest) {
  const ip = extractRequestIp(req.headers);
  const rl = await checkRateLimit(`corpus-chat-feedback:${ip}`, 30, 600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rating = typeof body.rating === "string" ? body.rating : "";
  if (!RATINGS.has(rating)) return NextResponse.json({ error: "rating must be HELPFUL, NOT_HELPFUL or ISSUE" }, { status: 400 });
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
  const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 20_000) : "";
  if (!question || !answer) return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  const issueType = rating === "ISSUE" && typeof body.issueType === "string" && ISSUE_TYPES.has(body.issueType) ? body.issueType : rating === "ISSUE" ? "OTHER" : null;
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) || null : null;
  const articleIds = cleanSourceIds(body.articleIds, 16);
  const model = typeof body.model === "string" ? body.model.slice(0, 120) : null;
  const session = getSessionFromHeaders(req.headers);
  if (rating === "ISSUE") {
    // Reports notify editors, so they get a tighter limit of their own.
    const issueLimit = await checkRateLimit(`corpus-chat-issue:${ip}`, 5, 3600);
    if (!issueLimit.ok) return NextResponse.json({ error: issueLimit.message }, { status: 429 });
  }

  const row = await db.researchFeedback.create({
    data: {
      userId: session?.userId ?? null,
      rating,
      issueType,
      comment,
      question,
      answer,
      articleIds: articleIds.length ? JSON.stringify(articleIds) : null,
      model,
    },
    select: { id: true },
  });

  if (rating === "ISSUE") {
    try {
      const editors = await db.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "EDITOR"] }, deletedAt: null },
        select: { id: true },
        take: 20,
      });
      await notifyMany(
        editors.map((e) => ({
          userId: e.id,
          type: "WARNING" as const,
          title: "Research Assistant answer reported",
          message: `${ISSUE_LABELS[issueType ?? "OTHER"]}. Question: “${question.slice(0, 200)}”${comment ? ` Reader's note: “${comment.slice(0, 300)}”` : ""} (report ${row.id})`,
          ...(articleIds[0] ? { articleId: articleIds[0] } : {}),
        }))
      );
    } catch (e) {
      console.error("[corpus-chat] issue notification failed:", e);
    }
  }
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}
