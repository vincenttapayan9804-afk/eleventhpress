import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assistantAdminScope, tenantRowFilter } from "@/lib/research-assistant-admin";

/**
 * GET /api/admin/research-assistant/feedback?rating=ISSUE|HELPFUL|NOT_HELPFUL
 *     &status=OPEN|RESOLVED&q=…&page=1 — readers' ratings and issue reports
 *     on Research Assistant answers, newest first, with the question, the
 *     answer and the cited articles.
 */
const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = await assistantAdminScope(req.headers, sp.get("tenantId"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const rating = sp.get("rating");
  const status = sp.get("status");
  const q = (sp.get("q") ?? "").trim().slice(0, 120);
  const page = Math.max(1, Math.min(500, Number(sp.get("page")) || 1));
  const where: Record<string, unknown> = { ...tenantRowFilter(scope) };
  if (rating === "ISSUE" || rating === "HELPFUL" || rating === "NOT_HELPFUL") where.rating = rating;
  if (status === "OPEN" || status === "RESOLVED") where.status = status;
  if (q) {
    const text = [{ question: { contains: q, mode: "insensitive" } }, { answer: { contains: q, mode: "insensitive" } }, { comment: { contains: q, mode: "insensitive" } }];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: text }];
      delete where.OR;
    } else where.OR = text;
  }
  const [rows, total] = await Promise.all([
    db.researchFeedback.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.researchFeedback.count({ where: where as any }),
  ]);
  const articleIds = [...new Set(rows.flatMap((r) => parseIds(r.articleIds)))];
  const articles = articleIds.length
    ? await db.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, title: true } }).catch(() => [] as { id: string; title: string }[])
    : [];
  const titleOf = new Map(articles.map((a) => [a.id, a.title]));
  const tenantIds = scope.all ? [...new Set(rows.map((r) => r.tenantId).filter((t): t is string => !!t))] : [];
  const tenants = tenantIds.length ? await db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }) : [];
  return NextResponse.json(
    {
      page,
      pageSize: PAGE_SIZE,
      total,
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        issueType: r.issueType,
        comment: r.comment,
        question: r.question,
        answer: r.answer,
        model: r.model,
        status: r.status,
        resolution: r.resolution,
        resolvedAt: r.resolvedAt,
        signedIn: !!r.userId,
        createdAt: r.createdAt,
        institution: scope.all ? (tenants.find((t) => t.id === r.tenantId)?.name ?? null) : undefined,
        articles: parseIds(r.articleIds).map((id) => ({ id, title: titleOf.get(id) ?? "Article no longer published" })),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
