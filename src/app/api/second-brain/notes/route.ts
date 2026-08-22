import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { computeSecondBrainLinks, isValidHexColor } from "@/lib/second-brain";

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
 * GET /api/second-brain/notes
 * Returns the signed-in user's own notes plus tag-overlap links between
 * them, computed live (see src/lib/second-brain.ts) rather than stored.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const notes = await db.secondBrainNote.findMany({
    where: { userId: session.userId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    notes,
    links: computeSecondBrainLinks(notes),
  });
}

/**
 * POST /api/second-brain/notes
 * Body: { title, content, tags?: string[], color?: string, pinned?: boolean }
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
    tags?: string[];
    color?: string;
    pinned?: boolean;
  };

  const title = (body.title || "").trim().slice(0, MAX_TITLE);
  const content = (body.content || "").trim().slice(0, MAX_CONTENT);
  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }
  if (body.color !== undefined && body.color !== null && !isValidHexColor(body.color)) {
    return NextResponse.json({ error: "color must be a hex value like #8b7cf6" }, { status: 400 });
  }

  const note = await db.secondBrainNote.create({
    data: {
      userId: session.userId,
      title,
      content,
      tags: normalizeTags(body.tags),
      color: body.color || null,
      pinned: !!body.pinned,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
