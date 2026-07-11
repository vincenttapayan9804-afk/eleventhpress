import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOjsIssuesExportXml } from "@/lib/ojs-native";

/**
 * GET /api/export/ojs/journal
 * Bulk PKP Native XML export: every issue that has at least one published
 * article, wrapped in an <issues> root. This is the format PKP's admin
 * guide recommends for bulk / back-issue import into a real OJS instance.
 */
export async function GET() {
  const journal = await db.journal.findFirst();
  if (!journal) {
    return NextResponse.json({ error: "Journal not configured" }, { status: 500 });
  }

  const issues = await db.issue.findMany({
    where: { journalId: journal.id, articles: { some: { status: "PUBLISHED" } } },
    include: { articles: { where: { status: "PUBLISHED" } } },
    orderBy: [{ year: "asc" }, { volume: "asc" }, { issueNumber: "asc" }],
  });

  const xml = await buildOjsIssuesExportXml({
    journal,
    issues: issues.map(({ articles, ...issue }) => ({ issue, articles })),
  });

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="eleventh-press-ojs-native-export.xml"',
      "Cache-Control": "no-store",
    },
  });
}
