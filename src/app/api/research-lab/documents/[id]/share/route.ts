import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * Tier 3 team-workspace sharing for a saved Gap Finder/PRISMA document.
 * Owner-only management; the collaborator is looked up by their own
 * account email (never invents an account — sharing with an email that
 * has no account on this platform is rejected, not silently queued).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!RESEARCH_LAB_ROLES.includes(session.role)) return NextResponse.json({ error: "Not available for this role" }, { status: 403 });

  const { id } = await params;
  const doc = await db.researchLabDocument.findUnique({ where: { id } });
  if (!doc || doc.userId !== session.userId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const shares = await db.researchLabDocumentShare.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
  });
  const users = shares.length
    ? await db.user.findMany({ where: { id: { in: shares.map((s) => s.sharedWithUserId) } }, select: { id: true, email: true, fullName: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    shares: shares.map((s) => ({ id: s.id, createdAt: s.createdAt, user: userById.get(s.sharedWithUserId) ?? null })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!RESEARCH_LAB_ROLES.includes(session.role)) return NextResponse.json({ error: "Not available for this role" }, { status: 403 });

  const { id } = await params;
  const doc = await db.researchLabDocument.findUnique({ where: { id } });
  if (!doc || doc.userId !== session.userId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const collaborator = await db.user.findUnique({ where: { email } });
  if (!collaborator) return NextResponse.json({ error: "No account found for that email" }, { status: 404 });
  if (collaborator.id === session.userId) return NextResponse.json({ error: "You already have access to your own document" }, { status: 400 });

  const share = await db.researchLabDocumentShare.upsert({
    where: { documentId_sharedWithUserId: { documentId: id, sharedWithUserId: collaborator.id } },
    create: { documentId: id, ownerUserId: session.userId, sharedWithUserId: collaborator.id },
    update: {},
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "RESEARCH_LAB_DOCUMENT_SHARED",
      entityType: "RESEARCH_LAB_DOCUMENT",
      entityId: id,
      metadata: JSON.stringify({ sharedWithUserId: collaborator.id, sharedWithEmail: email }),
    },
  });

  return NextResponse.json({ id: share.id, createdAt: share.createdAt, user: { id: collaborator.id, email: collaborator.email, fullName: collaborator.fullName } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!RESEARCH_LAB_ROLES.includes(session.role)) return NextResponse.json({ error: "Not available for this role" }, { status: 403 });

  const { id } = await params;
  const doc = await db.researchLabDocument.findUnique({ where: { id } });
  if (!doc || doc.userId !== session.userId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const shareId = req.nextUrl.searchParams.get("shareId");
  if (!shareId) return NextResponse.json({ error: "shareId is required" }, { status: 400 });

  const share = await db.researchLabDocumentShare.findUnique({ where: { id: shareId } });
  if (!share || share.documentId !== id) return NextResponse.json({ error: "Share not found" }, { status: 404 });

  await db.researchLabDocumentShare.delete({ where: { id: shareId } });
  return NextResponse.json({ ok: true });
}
