import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";

const PAGE_SIZE = 50;
const MAX_EXPORT_ROWS = 5000;

/**
 * GET /api/admin/audit-log
 * The platform's full, filterable AuditLog — SUPER_ADMIN only, same gate
 * as the "Admin & audit" dashboard tab this backs. Distinct from
 * GET /api/dashboard's `recentAudit`, which is a fixed 15-row preview for
 * the overview screen; this route adds the filtering, pagination, and CSV
 * export that preview never needed.
 *
 * Query params (all optional): action, entityType, userId, from, to (ISO
 * dates, inclusive), q (matches entityId, case-insensitive substring),
 * cursor (an AuditLog id to page from), format ("json" default | "csv").
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || undefined;
  const entityType = searchParams.get("entityType") || undefined;
  const userId = searchParams.get("userId") || undefined;
  const q = searchParams.get("q") || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cursor = searchParams.get("cursor") || undefined;
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...(q ? { entityId: { contains: q, mode: "insensitive" as const } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            // Inclusive of the whole "to" day, not just midnight.
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const take = format === "csv" ? MAX_EXPORT_ROWS : PAGE_SIZE;

  const entries = await withRlsContext(session, (tx) =>
    tx.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { fullName: true, role: true, email: true } } },
    })
  );

  const hasMore = entries.length > take;
  const page = hasMore ? entries.slice(0, take) : entries;

  if (format === "csv") {
    const header = "createdAt,action,entityType,entityId,userName,userEmail,userRole,articleId,metadata";
    const rows = page.map((e) =>
      [
        e.createdAt.toISOString(),
        e.action,
        e.entityType,
        e.entityId,
        e.user?.fullName ?? "",
        e.user?.email ?? "",
        e.user?.role ?? "",
        e.articleId ?? "",
        e.metadata ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    entries: page,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}

// Quotes a value for CSV, doubling any embedded quotes — the one escaping
// rule CSV actually needs (RFC 4180). Always quoted, even plain values,
// since metadata is free-form JSON text that may itself contain commas.
//
// Also guards against CSV/formula injection: userName and metadata both
// carry user-editable text (a profile's fullName, a submission's own
// title/discipline), and a spreadsheet app treats a cell starting with
// =, +, -, @, or a tab/CR as a formula to evaluate on open — a classic
// exfiltration vector once this file is opened in Excel/Sheets. Prefixing
// such a value with a plain apostrophe is the standard mitigation
// (OWASP's CSV Injection guidance): spreadsheet apps render it as literal
// text instead, and it has no effect on a CSV parsed back programmatically.
const FORMULA_LEADING_CHARS = /^[=+\-@\t\r]/;
function csvCell(value: string): string {
  const safe = FORMULA_LEADING_CHARS.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
