import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { translateAbstract, TRANSLATABLE_LOCALES, type TranslatableLocale } from "@/lib/manuscript-checks";

/**
 * POST /api/articles/[id]/translate
 * Body: { locale: "es" | "fr" | "fil" | "zh-Hans" }
 *
 * Translates the article's abstract into one locale of the site's
 * existing 5-locale i18n, via src/lib/manuscript-checks.ts's
 * translateAbstract(). Explicitly per-locale and editor/author-triggered
 * — never auto-run for all locales at publish time, matching every other
 * LLM-backed feature's opt-in shape. Corresponding author or an editor
 * may trigger this, same as /api/articles/[id]/ai-assist.
 */
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

  const result = await translateAbstract({ title: article.title, abstract: article.abstract }, locale);

  const translations = article.abstractTranslations ? JSON.parse(article.abstractTranslations) : {};
  const meta = article.abstractTranslationMeta ? JSON.parse(article.abstractTranslationMeta) : {};

  if (result.mode === "llm") {
    translations[locale] = result.translatedAbstract;
  }
  meta[locale] = { mode: result.mode, model: result.model, translatedAt: new Date().toISOString() };

  await db.article.update({
    where: { id },
    data: {
      abstractTranslations: JSON.stringify(translations),
      abstractTranslationMeta: JSON.stringify(meta),
    },
  });

  return NextResponse.json(result);
}
