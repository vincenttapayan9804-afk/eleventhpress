"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { parseAuthors } from "@/lib/article";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useReveal } from "@/hooks/use-scroll-reveal";
import { Search, BookMarked, FileX, FileText, Download } from "lucide-react";

const FORMAT_LABELS: Record<string, string> = {
  MONOGRAPH: "Monograph",
  EDITED_VOLUME: "Edited volume",
  ANTHOLOGY: "Anthology",
};

interface BookItem {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string;
  description: string;
  category: string;
  format: string;
  isbn?: string | null;
  coverImageUrl: string | null;
  epubUrl: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
}

export function BooksView() {
  const t = useTranslations("books");
  const [items, setItems] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");

  const headerReveal = useReveal();

  useEffect(() => {
    apiFetch<{ books: BookItem[] }>("/api/books")
      .then((res) => setItems(res.books))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((b) => b.category).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((b) => {
      if (category !== "ALL" && b.category !== category) return false;
      if (!query) return true;
      return (
        b.title.toLowerCase().includes(query) ||
        (b.subtitle || "").toLowerCase().includes(query) ||
        b.description.toLowerCase().includes(query) ||
        parseAuthors(b.authors).some((a: any) => (a.name || "").toLowerCase().includes(query))
      );
    });
  }, [items, q, category]);

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div ref={headerReveal.observe} className={`reveal ${headerReveal.inView ? "in-view" : ""} border-b border-[oklch(0.76_0.11_294/0.1)] pb-8`}>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Filters */}
      <div className="sticky top-16 z-30 mt-6">
        <div className="glass-strong rounded-2xl p-4 shadow-[0_12px_40px_oklch(0.38_0.18_295/0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="glass-panel h-11 pl-11 border-[oklch(0.76_0.11_294/0.2)]"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="glass-panel h-11 w-full border-[oklch(0.76_0.11_294/0.2)] sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="ALL">{t("allCategories")}</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {loading ? "Searching…" : t("booksFound", { count: filtered.length })}
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-80 shimmer rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center py-24 text-center">
          <FileX className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">{t("noBooksFound")}</p>
          <p className="text-sm text-muted-foreground">{t("tryAdjusting")}</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b, i) => {
            const authors = parseAuthors(b.authors);
            return (
              <div
                key={b.id}
                className="pearl-card flex flex-col overflow-hidden p-0 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_24px_64px_oklch(0.38_0.18_295/0.12)]"
                style={{ transitionTimingFunction: "var(--ease-luxury)", animationDelay: `${i * 60}ms` }}
              >
                {b.coverImageUrl ? (
                  <img
                    src={b.coverImageUrl}
                    alt={b.title}
                    loading="lazy"
                    decoding="async"
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-[oklch(0.93_0.04_290)]">
                    <BookMarked className="h-10 w-10 text-[oklch(0.42_0.18_295)]" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290/0.5)] text-[oklch(0.42_0.18_295)]">
                      {b.category}
                    </Badge>
                    <span className="font-mono text-[0.6rem] text-muted-foreground">{FORMAT_LABELS[b.format] || b.format}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-3 font-display text-base font-semibold leading-snug">{b.title}</h3>
                  {b.subtitle && <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">{b.subtitle}</p>}
                  <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{authors.map((au: any) => au.name).join(", ")}</p>
                  <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">{b.description}</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-[oklch(0.76_0.11_294/0.1)] pt-3">
                    {b.pdfUrl && (
                      <Button asChild variant="outline" size="sm" className="h-8 flex-1 text-xs">
                        <a href={b.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-1.5 h-3 w-3" /> PDF
                        </a>
                      </Button>
                    )}
                    {b.epubUrl && (
                      <Button asChild variant="outline" size="sm" className="h-8 flex-1 text-xs">
                        <a href={b.epubUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-1.5 h-3 w-3" /> EPUB
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
