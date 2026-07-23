"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Newspaper, Loader2, Download, FileText } from "lucide-react";

interface Piece {
  id: string;
  title: string;
  dek: string | null;
  authors: string;
  category: string;
  bodyHtml: string;
  heroImageUrl: string | null;
  isCoverStory: boolean;
  order: number;
}

interface IssueDetail {
  id: string;
  magazine: { name: string; slug: string; description: string };
  volume: number;
  issueNumber: number;
  year: number;
  title: string | null;
  theme: string | null;
  coverImageUrl: string | null;
  epubUrl: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  pieces: Piece[];
}

function authorNames(json: string): string {
  try {
    return (JSON.parse(json) as { name?: string }[]).map((a) => a.name).filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

function issueLabel(i: Pick<IssueDetail, "title" | "volume" | "issueNumber" | "year">) {
  return i.title || `Volume ${i.volume}, No. ${i.issueNumber}`;
}

function PieceReader({ piece, onBack }: { piece: Piece; onBack: () => void }) {
  const t = useTranslations("magazines");
  return (
    <div className="page-enter mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("backToIssue")}
      </button>
      <p className="eyebrow mt-6">{piece.category}</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] sm:text-5xl">{piece.title}</h1>
      {piece.dek && <p className="mt-4 font-serif text-xl italic leading-relaxed text-muted-foreground">{piece.dek}</p>}
      <p className="mt-6 border-t border-foreground/10 pt-4 text-sm font-medium">{t("byAuthor", { name: authorNames(piece.authors) })}</p>
      {piece.heroImageUrl && (
        <img src={piece.heroImageUrl} alt={piece.title} className="mt-8 w-full rounded-xl object-cover" />
      )}
      <div className="prose prose-stone mt-8 max-w-none font-serif text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: piece.bodyHtml }} />
    </div>
  );
}

export function MagazineIssueView() {
  const t = useTranslations("magazines");
  const { magazineIssueId, setView } = useApp();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingPieceId, setReadingPieceId] = useState<string | null>(null);

  useEffect(() => {
    if (!magazineIssueId) return;
    setLoading(true);
    setReadingPieceId(null);
    apiFetch<{ issue: IssueDetail }>(`/api/magazine-issues/${magazineIssueId}`)
      .then((res) => setIssue(res.issue))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [magazineIssueId]);

  if (loading || !issue) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const readingPiece = issue.pieces.find((p) => p.id === readingPieceId);
  if (readingPiece) {
    return <PieceReader piece={readingPiece} onBack={() => setReadingPieceId(null)} />;
  }

  const coverStory = issue.pieces.find((p) => p.isCoverStory) || issue.pieces[0];
  const rest = issue.pieces.filter((p) => p.id !== coverStory?.id);

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Masthead */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground/90 pb-6">
        <div>
          <button onClick={() => setView("magazines")} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("allIssuesBack")}
          </button>
          <p className="eyebrow mt-3">{issue.magazine.name}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">{issueLabel(issue)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vol. {issue.volume}, No. {issue.issueNumber} · {issue.year}
            {issue.theme && ` · ${issue.theme}`}
          </p>
        </div>
        <div className="flex gap-2">
          {issue.pdfUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={issue.pdfUrl} target="_blank" rel="noopener noreferrer"><FileText className="mr-1.5 h-3.5 w-3.5" /> {t("pdf")}</a>
            </Button>
          )}
          {issue.epubUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={issue.epubUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-1.5 h-3.5 w-3.5" /> {t("epub")}</a>
            </Button>
          )}
        </div>
      </div>

      {/* Cover story hero */}
      {coverStory && (
        <button
          onClick={() => setReadingPieceId(coverStory.id)}
          className="cover-click-glow group mt-8 grid w-full gap-0 overflow-hidden rounded-2xl border border-foreground/10 bg-black text-left shadow-[0_24px_64px_oklch(0.38_0.18_295/0.18)] transition-all duration-500 hover:shadow-[0_32px_80px_oklch(0.38_0.18_295/0.28)] lg:grid-cols-2"
        >
          <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto">
            {coverStory.heroImageUrl || issue.coverImageUrl ? (
              <img src={coverStory.heroImageUrl || issue.coverImageUrl!} alt={coverStory.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.25_0.08_295)] to-black">
                <Newspaper className="h-16 w-16 text-white/30" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center px-8 py-10 sm:px-12 sm:py-14">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[oklch(0.76_0.11_294)]">{coverStory.category} · {t("coverStory")}</p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl">{coverStory.title}</h2>
            {coverStory.dek && <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-white/70">{coverStory.dek}</p>}
            <p className="mt-6 text-sm font-medium text-white/60">{t("byAuthor", { name: authorNames(coverStory.authors) })}</p>
          </div>
        </button>
      )}

      {/* Grid — remaining pieces */}
      {rest.length > 0 && (
        <div className="mt-14">
          <p className="eyebrow border-b border-foreground/10 pb-3">{t("inThisIssue")}</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((piece, i) => (
              <button
                key={piece.id}
                onClick={() => setReadingPieceId(piece.id)}
                className="group flex flex-col text-left"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {piece.heroImageUrl && (
                  <div className="mb-4 aspect-[16/10] overflow-hidden rounded-lg bg-[oklch(0.93_0.04_290)]">
                    <img src={piece.heroImageUrl} alt={piece.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                )}
                <Badge variant="outline" className="w-fit border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290/0.5)] text-[0.65rem] text-[oklch(0.42_0.18_295)]">{piece.category}</Badge>
                <h3 className="mt-2 font-display text-xl font-semibold leading-snug transition-colors group-hover:text-[oklch(0.42_0.18_295)]">{piece.title}</h3>
                {piece.dek && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{piece.dek}</p>}
                <p className="mt-3 text-xs font-medium text-muted-foreground">{t("byAuthor", { name: authorNames(piece.authors) })}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
