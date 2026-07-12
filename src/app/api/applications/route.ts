import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (session.role === "SUPER_ADMIN") {
    const status = req.nextUrl.searchParams.get("status");
    const where = status ? { status } : {};
    const applications = await db.roleApplication.findMany({
      where,
      include: { applicant: { select: { id: true, email: true, fullName: true, affiliation: true, country: true, orcid: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
  }

  const applications = await db.roleApplication.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { requestedRole, applicationText, orcidId, expertise, specializations, resumeKey, transcriptKey, certificateKeys } = body as {
    requestedRole?: string;
    applicationText?: string;
    orcidId?: string;
    expertise?: string;
    specializations?: string;
    resumeKey?: string;
    transcriptKey?: string;
    certificateKeys?: string[];
  };

  if (!requestedRole || !["REVIEWER", "EDITOR"].includes(requestedRole)) {
    return NextResponse.json({ error: "requestedRole must be REVIEWER or EDITOR" }, { status: 400 });
  }

  const existing = await db.roleApplication.findFirst({
    where: { userId: session.userId, requestedRole, status: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
  if (existing) {
    const updated = await db.roleApplication.update({
      where: { id: existing.id },
      data: {
        applicationText: applicationText ?? existing.applicationText,
        orcidId: orcidId ?? existing.orcidId,
        expertise: expertise ?? existing.expertise,
        specializations: specializations ?? existing.specializations,
        resumeKey: resumeKey ?? existing.resumeKey,
        transcriptKey: transcriptKey ?? existing.transcriptKey,
        certificateKeys: certificateKeys ? JSON.stringify(certificateKeys) : existing.certificateKeys,
      },
    });
    return NextResponse.json({ application: updated });
  }

  const application = await db.roleApplication.create({
    data: {
      userId: session.userId,
      requestedRole,
      applicationText: applicationText || null,
      orcidId: orcidId || null,
      expertise: expertise || null,
      specializations: specializations || null,
      resumeKey: resumeKey || null,
      transcriptKey: transcriptKey || null,
      certificateKeys: certificateKeys ? JSON.stringify(certificateKeys) : null,
    },
  });

  return NextResponse.json({ application }, { status: 201 });
}
