import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import {
  translateGalleyText,
  getGalleyTranslation,
  TRANSLATABLE_LOCALES,
  type TranslatableLocale,
} from "@/lib/galley-translation";

/**
 * POST /api/articles/[id]/translate-galley
 * Body: { locale: "es" | "fr" | "fil" | "zh-Hans" }
 *
 * Full-text counterpart to /api/articles/[id]/translate (which only
 * translates the abstract) — translates the article's complete galley
 * body via src/lib/galley-translation.ts. Same editor/corresponding-
 * author-triggered, explicitly per-locale shape as every other LLM-backed
 * feature in this codebase; never auto-run for all locales.
 *
 * On-demand translation of a full article can take a while (several
 * batched LLM calls) — 60s is the ceiling obtainable without a Vercel Pro
 * plan, same reasoning as the RAG chat routes' maxDuration.
 */
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const { locale } = (await req.json()) as { locale: TranslatableLocale };
  if (!TRANSLATABLE_LOCALES.includes(locale)) {
    return NextResponse.json({ error: `locale must be one of ${TRANSLATABLE_LOCALES.join(", ")}` }, { status: 400 });
  }

  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const isEditor = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role);
  const isOwner = article.correspondingAuthorId === session.userId;
  if (!isEditor && !isOwner) {
    return NextResponse.json({ error: "Not authorized for this article" }, { status: 403 });
  }

  try {
    const result = await translateGalleyText(id, locale);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`[translate-galley] failed for article ${id}, locale ${locale}:`, e);
    return NextResponse.json({ error: e?.message || "Translation failed" }, { status: 502 });
  }
}

/**
 * GET /api/articles/[id]/translate-galley?locale=es
 *
 * Public — reads back a previously-generated full-text translation, same
 * public-read/gated-write shape as most content in this codebase. Returns
 * mode: "not-translated" (200, not 404) if no translation has been
 * requested yet for that locale, so the UI can show an honest empty state.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = req.nextUrl.searchParams.get("locale") as TranslatableLocale | null;
  if (!locale || !TRANSLATABLE_LOCALES.includes(locale)) {
    return NextResponse.json({ error: `locale must be one of ${TRANSLATABLE_LOCALES.join(", ")}` }, { status: 400 });
  }

  const article = await db.article.findUnique({ where: { id }, select: { status: true } });
  if (!article || article.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const existing = await getGalleyTranslation(id, locale);
  if (!existing) {
    return NextResponse.json({ mode: "not-translated" });
  }

  return NextResponse.json({
    mode: existing.mode,
    translatedText: existing.translatedText,
    model: existing.model,
    translatedAt: existing.translatedAt,
  });
}
