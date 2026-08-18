import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { ETHICS_SUBMISSION_TYPES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";
import { withTenantRlsContext } from "@/lib/db-rls";

/**
 * GET/POST /api/ethics-submissions
 * EP University OS Phase 3 — self-service filing of IRB protocol
 * submissions and conflict-of-interest disclosures. Any authenticated
 * session may file one (a reviewer files a COI disclosure the same way a
 * researcher files an IRB protocol — neither needs an editorial role);
 * GET returns only the caller's own submissions, mirroring how
 * /api/applications scopes a non-SUPER_ADMIN session to `userId:
 * session.userId`. The tenant-wide admin listing lives separately at
 * /api/admin/ethics-submissions.
 */

const CreateEthicsSubmissionSchema = z.object({
  submissionType: z.enum(ETHICS_SUBMISSION_TYPES as [string, ...string[]]),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  departmentId: z.string().min(1).optional(),
  articleId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const submissions = await withTenantRlsContext(session.tenantId ?? null, (tx) =>
    tx.ethicsSubmission.findMany({
      where: { submittedByUserId: session.userId },
      orderBy: { createdAt: "desc" },
    })
  );

  return NextResponse.json({ submissions });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!session.tenantId) {
    return NextResponse.json({ error: "Your session has no tenant context" }, { status: 400 });
  }

  const parsed = await parseBody(req, CreateEthicsSubmissionSchema);
  if (!parsed.ok) return parsed.response;
  const { submissionType, title, description, departmentId, articleId } = parsed.data;

  if (departmentId) {
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department || department.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "departmentId must belong to your tenant" }, { status: 400 });
    }
  }

  if (articleId) {
    const article = await db.article.findUnique({ where: { id: articleId }, include: { journal: { select: { tenantId: true } } } });
    if (!article || (article.journal.tenantId && article.journal.tenantId !== session.tenantId)) {
      return NextResponse.json({ error: "articleId must belong to your tenant" }, { status: 400 });
    }
  }

  const submission = await db.ethicsSubmission.create({
    data: {
      tenantId: session.tenantId,
      submissionType,
      title,
      description: description ?? null,
      departmentId: departmentId ?? null,
      articleId: articleId ?? null,
      submittedByUserId: session.userId,
    },
  });

  return NextResponse.json({ submission }, { status: 201 });
}
