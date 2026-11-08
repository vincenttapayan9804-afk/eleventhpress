import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { canActOnArticle } from "@/lib/tenant-auth";

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];

const DECISION_LABELS: Record<string, string> = {
  SEND_TO_REVIEW: "Sent to peer review",
  ASSIGN_REVIEWERS: "Reviewers assigned",
  REQUEST_REVISIONS: "Revisions requested",
  ACCEPT: "Accepted for publication",
  REJECT: "Not accepted",
  SEND_TO_PRODUCTION: "Moved to production",
  PUBLISH: "Published",
  WITHDRAW: "Withdrawn",
};

const NEXT_STEP: Record<string, string> = {
  DRAFT: "Finish and submit your manuscript.",
  SUBMITTED: "An editor is screening your submission for scope and quality. This usually takes a few days.",
  UNDER_REVIEW: "Independent reviewers are assessing your manuscript. You'll be notified as soon as there's a decision.",
  REVISIONS_REQUIRED: "Read the reviews, revise your manuscript and respond to each comment.",
  ACCEPTED: "Pay the publication charge (or await your waiver decision) so production can begin.",
  IN_PRODUCTION: "Your article is being typeset. You'll be notified when it's published.",
  PUBLISHED: "Your article is live. Share it and track its readership in My Articles.",
  REJECTED: "Read the decision letter. You're welcome to submit a substantially revised manuscript in future.",
  WITHDRAWN: "This submission has been withdrawn.",
};

/**
 * GET /api/articles/[id]/timeline — the submission tracker: every stage the
 * manuscript has been through with dates, peer-review progress (reviewers
 * anonymised for the author), co-author confirmations and what happens next.
 * For the corresponding author and the article's editors.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { id: true, status: true, correspondingAuthorId: true, createdAt: true, submittedAt: true, acceptedAt: true, publishedAt: true },
  });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isEditor = EDITOR_ROLES.includes(session.role) && (await canActOnArticle(session, id));
  if (article.correspondingAuthorId !== session.userId && !isEditor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [decisions, reviews, confirmations, revisions] = await Promise.all([
    db.editorialDecision.findMany({ where: { articleId: id }, orderBy: { createdAt: "asc" }, select: { decision: true, createdAt: true } }),
    db.review.findMany({
      where: { articleId: id },
      orderBy: { createdAt: "asc" },
      select: { status: true, createdAt: true, respondedAt: true, completedAt: true, dueDate: true },
    }),
    db.authorshipConfirmation.findMany({
      where: { articleId: id },
      orderBy: { createdAt: "asc" },
      select: { name: true, status: true, respondedAt: true },
    }),
    db.articleRevision.findMany({ where: { articleId: id }, select: { round: true, createdAt: true } }),
  ]);

  const events: { at: string; label: string; kind: "stage" | "review" | "decision" }[] = [];
  events.push({ at: (article.submittedAt ?? article.createdAt).toISOString(), label: "Submitted", kind: "stage" });
  for (const d of decisions) events.push({ at: d.createdAt.toISOString(), label: DECISION_LABELS[d.decision] ?? d.decision, kind: "decision" });
  reviews.forEach((r, i) => {
    if (r.completedAt) events.push({ at: r.completedAt.toISOString(), label: `Review ${i + 1} completed`, kind: "review" });
  });
  for (const r of revisions) events.push({ at: r.createdAt.toISOString(), label: `Revision ${r.round} submitted`, kind: "stage" });
  if (article.publishedAt && !decisions.some((d) => d.decision === "PUBLISH")) {
    events.push({ at: article.publishedAt.toISOString(), label: "Published", kind: "stage" });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  const active = reviews.filter((r) => ["ACCEPTED", "IN_PROGRESS"].includes(r.status));
  return NextResponse.json({
    status: article.status,
    next: NEXT_STEP[article.status] ?? null,
    events,
    review: {
      invited: reviews.length,
      declined: reviews.filter((r) => r.status === "DECLINED").length,
      inProgress: active.length,
      completed: reviews.filter((r) => r.status === "COMPLETED").length,
      // The latest due date among reviews in progress — when a decision can be expected.
      expectedBy: active.map((r) => r.dueDate).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null,
    },
    coAuthors: confirmations,
  });
}
