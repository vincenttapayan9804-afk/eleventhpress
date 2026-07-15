"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import HTMLFlipBook from "react-pageflip";

/**
 * Real page-turn viewer of the article's actual PDF galley — not a
 * reflowed-HTML approximation. pdfjs-dist (already a project dependency
 * for server-side text extraction, src/lib/galley.ts) renders each real
 * PDF page to a canvas image entirely in the visitor's browser; no
 * server-side PDF-to-image rasterization, which avoids native-module
 * risk on Vercel's serverless runtime. react-pageflip then handles the
 * page-turn interaction over those images.
 *
 * Rendering is progressive: page 1 renders first and the flipbook opens
 * as soon as it's ready, while the rest stream in behind it via a small
 * concurrency pool — readers don't wait for a 20+ page PDF to fully
 * rasterize before they can start reading. Pages encode as JPEG rather
 * than PNG (much faster to encode, smaller data URLs) since this is a
 * page-scan viewer, not a graphics tool needing lossless output.
 */

type LoadState = "idle" | "loading" | "ready" | "error";

const RENDER_CONCURRENCY = 2;

interface Props {
  articleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArticleFlipbook({ articleId, open, onOpenChange }: Props) {
  const [state, setState] = useState<LoadState>("idle");
  const [pages, setPages] = useState<(string | null)[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const flipBookRef = useRef<any>(null);

  useEffect(() => {
    if (!open || state !== "idle") return;

    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        const { url } = await apiFetch<{ url: string }>(`/api/articles/${articleId}/galley?format=pdf`);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;

        const numPages = pdf.numPages;
        setPages(new Array(numPages).fill(null));

        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas 2D context unavailable");
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          return canvas.toDataURL("image/jpeg", 0.82);
        };

        const firstPage = await renderPage(1);
        if (cancelled) return;
        setPages((prev) => {
          const next = [...prev];
          next[0] = firstPage;
          return next;
        });
        setState("ready");

        const remainingPageNumbers = Array.from({ length: numPages - 1 }, (_, i) => i + 2);
        let cursor = 0;
        const worker = async () => {
          while (cursor < remainingPageNumbers.length) {
            const pageNum = remainingPageNumbers[cursor++];
            if (cancelled) return;
            const src = await renderPage(pageNum);
            if (cancelled) return;
            setPages((prev) => {
              const next = [...prev];
              next[pageNum - 1] = src;
              return next;
            });
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(RENDER_CONCURRENCY, remainingPageNumbers.length) }, worker)
        );
      } catch (e: any) {
        if (!cancelled) {
          setErrorMessage(e?.message || "Could not render the PDF for the flipbook view.");
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, state, articleId]);

  // Reset so re-opening after a close re-fetches (a newly re-generated
  // galley shouldn't stay stuck showing a stale cached render).
  useEffect(() => {
    if (!open) {
      setState("idle");
      setPages([]);
      setErrorMessage(null);
    }
  }, [open]);

  const loadedCount = pages.filter(Boolean).length;
  const stillStreaming = state === "ready" && loadedCount < pages.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Flipbook view</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-hidden">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              Rendering pages…
            </div>
          )}
          {state === "error" && (
            <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p>Flipbook unavailable</p>
              <p className="text-xs">{errorMessage}</p>
            </div>
          )}
          {state === "ready" && pages.length > 0 && (
            <div className="flex w-full flex-col items-center gap-3">
              <HTMLFlipBook
                ref={flipBookRef}
                width={480}
                height={640}
                size="stretch"
                minWidth={280}
                maxWidth={900}
                minHeight={380}
                maxHeight={1200}
                showCover={false}
                drawShadow={true}
                flippingTime={500}
                usePortrait={true}
                startZIndex={0}
                startPage={0}
                autoSize={true}
                maxShadowOpacity={0.5}
                mobileScrollSupport={true}
                clickEventForward={true}
                useMouseEvents={true}
                swipeDistance={30}
                showPageCorners={true}
                disableFlipByClick={false}
                className="mx-auto"
                style={{}}
              >
                {pages.map((src, i) => (
                  <div key={i} className="flex items-center justify-center bg-white">
                    {src ? (
                      // A client-generated canvas data URL, not an optimizable remote/static asset — next/image doesn't apply here.
                      <img src={src} alt={`Page ${i + 1}`} className="h-full w-full object-contain" />
                    ) : (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ))}
              </HTMLFlipBook>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <button
                  type="button"
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                  onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pages.length} page{pages.length === 1 ? "" : "s"}
                {stillStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
                <button
                  type="button"
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                  onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
