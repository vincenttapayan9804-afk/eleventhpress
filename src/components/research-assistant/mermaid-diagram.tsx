"use client";

/**
 * A ```mermaid block in a Research Assistant answer, drawn with Mermaid.
 * Mermaid is loaded only when an answer has a diagram, with securityLevel
 * "strict" (no HTML labels, no click handlers). If it can't be drawn, its
 * code is shown instead.
 */
import { useEffect, useId, useState } from "react";

type MermaidApi = typeof import("mermaid").default;
let mermaidLoad: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  mermaidLoad ??= import("mermaid").then((m) => {
    const dark = document.documentElement.classList.contains("dark");
    m.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "neutral",
      fontFamily: "inherit",
      flowchart: { htmlLabels: false },
    });
    return m.default;
  });
  return mermaidLoad;
}

const MAX_DIAGRAM = 4000;

export function MermaidDiagram({ code }: { code: string }) {
  const id = `ra-mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // Keyed by the code it was drawn from, so a changed diagram never shows the old drawing.
  const [drawn, setDrawn] = useState<{ code: string; svg: string | null } | null>(null);
  const tooLong = code.length > MAX_DIAGRAM;

  useEffect(() => {
    if (tooLong) return;
    let live = true;
    loadMermaid()
      .then(async (mermaid) => {
        // parse first: a bad diagram fails here without leaving an error graphic in the page.
        await mermaid.parse(code);
        const { svg } = await mermaid.render(id, code);
        if (live) setDrawn({ code, svg });
      })
      .catch(() => {
        document.getElementById(`d${id}`)?.remove();
        if (live) setDrawn({ code, svg: null });
      });
    return () => {
      live = false;
    };
  }, [code, id, tooLong]);

  const state = tooLong ? { svg: null } : drawn?.code === code ? drawn : null;
  if (state?.svg) {
    return (
      <figure className="my-3.5 overflow-x-auto rounded-lg border border-border/80 bg-card p-3 epip-scroll" aria-label="Diagram">
        {/* Mermaid's SVG, rendered with securityLevel "strict" (sanitised, no scripts or HTML labels). */}
        <div className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: state.svg }} />
      </figure>
    );
  }
  return (
    <figure className="my-3.5">
      <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-[0.78rem] leading-relaxed epip-scroll">
        <code>{code}</code>
      </pre>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">{state ? "The diagram couldn't be drawn, so its source is shown." : "Drawing the diagram…"}</figcaption>
    </figure>
  );
}
