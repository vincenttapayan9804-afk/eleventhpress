import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { presignGet } from "@/lib/storage";
import { KOKORO_VOICES, type NarrationContentType } from "@/lib/kokoro-tts";

const EDITORIAL_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * GET /api/narration/candidates?contentType=ARTICLE&query=foo
 * Lists up to 50 published items of one content type, each joined with its
 * NarrationJob status (or null if narration was never triggered) — the
 * data source for the dashboard's Narration admin tab content picker.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, EDITORIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType") as NarrationContentType | null;
  const query = (searchParams.get("query") || "").trim();

  let items: { id: string; title: string; subtitle: string }[] = [];

  if (contentType === "ARTICLE") {
    const rows = await db.article.findMany({
      where: { status: "PUBLISHED", ...(query ? { title: { contains: query, mode: "insensitive" } } : {}) },
      select: { id: true, title: true, discipline: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    items = rows.map((r) => ({ id: r.id, title: r.title, subtitle: r.discipline }));
  } else if (contentType === "MAGAZINE_PIECE") {
    const rows = await db.magazinePiece.findMany({
      where: {
        issue: { status: "PUBLISHED" },
        ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
      },
      select: { id: true, title: true, category: true, issue: { select: { magazine: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    items = rows.map((r) => ({ id: r.id, title: r.title, subtitle: `${r.issue.magazine.name} · ${r.category}` }));
  } else if (contentType === "MEDIA_POST") {
    const rows = await db.mediaPost.findMany({
      where: { status: "PUBLISHED", ...(query ? { title: { contains: query, mode: "insensitive" } } : {}) },
      select: { id: true, title: true, type: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    items = rows.map((r) => ({ id: r.id, title: r.title, subtitle: `${r.type} · ${r.category}` }));
  } else {
    return NextResponse.json({ error: "contentType must be one of ARTICLE, MAGAZINE_PIECE, MEDIA_POST" }, { status: 400 });
  }

  const jobs = await db.narrationJob.findMany({
    where: { contentType, contentId: { in: items.map((i) => i.id) } },
    select: { id: true, contentId: true, voice: true, status: true, durationSec: true, audioKey: true, errorMessage: true },
    orderBy: { voice: "asc" },
  });
  const narrationsByContentId = new Map<string, any[]>();
  for (const j of jobs) {
    const meta = KOKORO_VOICES.find((v) => v.id === j.voice);
    const entry = {
      id: j.id,
      voice: j.voice,
      label: meta?.label || j.voice,
      status: j.status,
      durationSec: j.durationSec,
      errorMessage: j.errorMessage,
      audioUrl: j.status === "COMPLETED" && j.audioKey ? await presignGet(j.audioKey) : null,
    };
    const list = narrationsByContentId.get(j.contentId) || [];
    list.push(entry);
    narrationsByContentId.set(j.contentId, list);
  }

  return NextResponse.json({
    items: items.map((i) => ({ ...i, narrations: narrationsByContentId.get(i.id) || [] })),
  });
}
