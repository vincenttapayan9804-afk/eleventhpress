"use client";

/**
 * Lazy, SSR-disabled wrapper around @embedpdf/react-pdf-viewer's <PDFViewer>
 * — a full PDFium-WASM-backed reader (toolbar, zoom, thumbnails, search)
 * that renders a galley PDF inline instead of relying on whatever the
 * visitor's mobile browser/OS does with a bare PDF URL (downloads instead
 * of opening, a stripped-down native viewer, or an in-app browser that
 * can't render PDFs at all). Only mounted on demand — the WASM engine is a
 * multi-MB payload no visitor should pay for until they actually ask to
 * read inline, matching this codebase's established pattern for heavy
 * client widgets (see src/components/three-d/lazy.tsx).
 */
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

const PDFViewerImpl = dynamic(() => import("@embedpdf/react-pdf-viewer").then((m) => m.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading viewer…
    </div>
  ),
});

class PdfPreviewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[pdf-preview] viewer failed:", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Couldn&apos;t load the inline preview. Use Download PDF instead.
        </div>
      );
    }
    return this.props.children;
  }
}

export function PdfPreview({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-md border border-border ${className}`}>
      <PdfPreviewErrorBoundary>
        <PDFViewerImpl
          config={{
            src,
            theme: { preference: "system", light: { accent: { primary: "#9333ea" } } },
            // A read-only academic galley never needs stamping/redaction
            // tools, and the annotation category is what pulls in the
            // default-stamps asset pack from a third-party CDN
            // (cdn.jsdelivr.net) at runtime — dropping it removes an
            // external dependency this preview has no use for.
            disabledCategories: ["annotation", "redaction"],
            // The engine defaults to fetching its ~4.4MB WASM binary from
            // cdn.jsdelivr.net on every load — self-hosted here (copied
            // into /public at build time from @embedpdf/pdfium's own
            // dist/pdfium.wasm) to match this app's existing pattern of
            // never depending on a third-party CDN for core functionality
            // (webfonts are self-hosted via next/font for the same reason).
            wasmUrl: "/pdfium.wasm",
            // Skip the default Open Sans Google Fonts <link> for the
            // viewer's own toolbar chrome — same self-hosting rationale;
            // falls back to the system font stack instead.
            fonts: { ui: null },
            // Only relevant for PDFs with unembedded non-Latin-script text
            // needing a substitute glyph source — this app's galleys are
            // PDFKit-generated with embedded fonts, so there's nothing for
            // this to substitute, and disabling it removes another
            // default CDN dependency (jsDelivr-hosted fallback fonts).
            fontFallback: null,
            // Default (worker: true) runs the PDFium engine in a Worker,
            // which never completed initialization in testing here
            // despite every prerequisite (worker-src CSP, cross-origin
            // isolation, self-hosted WASM) being in place — an
            // unresolved incompatibility between this exact library
            // version and this app's Turbopack-bundled blob-URL worker
            // context, not a config problem. worker: false runs PDFium
            // on the main thread instead, which does work end-to-end;
            // the tradeoff is that page rendering can briefly block the
            // main thread on a slow device, which is preferable to a
            // preview that never loads at all.
            worker: false,
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </PdfPreviewErrorBoundary>
    </div>
  );
}
