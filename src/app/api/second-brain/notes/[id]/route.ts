import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { isValidHexColor } from "@/lib/second-brain";

const MAX_TITLE = 200;
const MAX_CONTENT = 20000;
const MAX_TAGS = 12;
const MAX_TAG_LEN = 40;

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return Array.from(seen);
}

/**
 * PATCH /api/second-brain/notes/[id]
 * Owner-only partial update. Body may include any of title/content/tags/
 * color/pinned — only the keys present are changed.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.secondBrainNote.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
    tags?: string[];
    color?: string | null;
    pinned?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = body.title.trim().slice(0, MAX_TITLE);
    if (!title) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    data.title = title;
  }
  if (body.content !== undefined) {
    const content = body.content.trim().slice(0, MAX_CONTENT);
    if (!content) return NextResponse.json({ error: "content cannot be empty" }, { status: 400 });
    data.content = content;
  }
  if (body.tags !== undefined) {
    data.tags = normalizeTags(body.tags);
  }
  if (body.color !== undefined) {
    if (body.color !== null && !isValidHexColor(body.color)) {
      return NextResponse.json({ error: "color must be a hex value like #8b7cf6" }, { status: 400 });
    }
    data.color = body.color;
  }
  if (body.pinned !== undefined) {
    data.pinned = !!body.pinned;
  }

  const note = await db.secondBrainNote.update({ where: { id }, data });
  return NextResponse.json({ note });
}

/** DELETE /api/second-brain/notes/[id] — owner-only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.secondBrainNote.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await db.secondBrainNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
