/**
 * Equations and diagrams in Research Assistant answers, shared by the live
 * answer, the finished answer and the shared-conversation page.
 *
 * - Equations: `$$…$$` (inline or on its own lines) is typeset with KaTeX.
 *   A single `$` is never maths, so "$5 and $10" stays text. KaTeX's CSS
 *   and fonts are bundled, so they load from the site itself and fit the
 *   Content-Security-Policy as it is.
 * - Diagrams: a ```mermaid block becomes <MermaidDiagram> (mermaid-diagram.tsx).
 *
 * No "use client": the shared page renders on the server and calls these directly.
 */
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { PluggableList } from "unified";
import { MermaidDiagram } from "./mermaid-diagram";

export const REMARK_PLUGINS: PluggableList = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]];
export const REHYPE_PLUGINS: PluggableList = [[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false, maxSize: 20, maxExpand: 200 }]];

export { outsideMathAndCode } from "@/lib/answer-markdown";

/** Plain text of a hast node. */
function textOf(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n?.type === "text") return n.value ?? "";
  return (n?.children ?? []).map(textOf).join("");
}

/**
 * `pre` and `code` renderers shared by every answer view: ```mermaid blocks
 * become diagrams, other fenced blocks stay code.
 */
export const CODE_COMPONENTS: Pick<Components, "pre" | "code"> = {
  pre: ({ node, children }) => {
    const first = (node?.children ?? []).find((c) => c.type === "element") as { tagName?: string; properties?: { className?: unknown } } | undefined;
    const cls = first?.properties?.className;
    const classes = Array.isArray(cls) ? cls.map(String) : typeof cls === "string" ? cls.split(/\s+/) : [];
    if (first?.tagName === "code" && classes.includes("language-mermaid")) {
      return <MermaidDiagram code={textOf(first).trim()} />;
    }
    return <pre className="my-3 overflow-x-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-[0.8rem] leading-relaxed epip-scroll">{children as ReactNode}</pre>;
  },
  code: ({ className, children }) =>
    className?.startsWith("language-") ? (
      <code className="font-mono">{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>
    ),
};
