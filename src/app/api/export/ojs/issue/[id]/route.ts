import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOjsIssueXml } from "@/lib/ojs-native";

/**
 * GET /api/export/ojs/issue/[id]
 * Returns a PKP Native XML <issue> element (with nested <articles> for
 * that issue's published articles) for hand-import into a real OJS
 * installation. See /api/export/ojs/article/[id] for the auth/exposure
 * rationale — same pattern.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const issue = await db.issue.findUnique({
    where: { id },
    include: {
      journal: true,
      articles: { where: { status: "PUBLISHED" } },
    },
  });
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const { articles, journal, ...issueRest } = issue;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
${buildOjsIssueXml({ issue: issueRest, articles, journal })}`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
