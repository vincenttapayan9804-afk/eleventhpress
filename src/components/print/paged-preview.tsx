"use client";

// ---------------------------------------------------------------------------
// PagedPreview — runs the real, free, open-source Paged.js pagination
// engine (no server, no per-render cost) over the server-rendered content
// in #print-source, injecting real paginated `.pagedjs_page` boxes (with
// the running header/page-number footer from public/print/print-layout.css)
// into #print-target. This is a genuine print/PDF-ready layout: once
// paginated, the browser's native print dialog ("Save as PDF") produces a
// properly paginated document — no separate PDF-generation step needed.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

export function PagedPreview({ cssHref }: { cssHref: string }) {
  const [status, setStatus] = useState<"rendering" | "done" | "error">("rendering");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Previewer } = await import("pagedjs");
        const source = document.getElementById("print-source");
        const target = document.getElementById("print-target");
        if (!source || !target) throw new Error("print-source/print-target not found");
        const previewer = new Previewer();
        const flow = await previewer.preview(source, [cssHref], target);
        if (!cancelled) {
          setPageCount(flow.total);
          setStatus("done");
          source.remove();
        }
      } catch (e) {
        console.error("[paged-preview] pagination failed:", e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cssHref]);

  return (
    <div className="print-preview-status no-print">
      {status === "rendering" && <p>Laying out pages…</p>}
      {status === "done" && (
        <p>
          {pageCount} page{pageCount === 1 ? "" : "s"} — use your browser&apos;s print dialog (Ctrl/Cmd+P) and choose
          &ldquo;Save as PDF&rdquo; to download.
        </p>
      )}
      {status === "error" && <p>Pagination failed — the plain content above is still readable and printable.</p>}
    </div>
  );
}
