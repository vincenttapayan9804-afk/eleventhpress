import { Fragment } from "react";

const MARKERS = /((?:\[\d+\])+)/g;

/**
 * Renders text containing citation markers ("… in 2025 [1][3].") with each
 * marker as a superscript link to its entry in the reference list
 * (#ref-1, #ref-3). Works on the server; no client JavaScript.
 */
export function CitedText({ text }: { text: string }) {
  const parts = text.split(MARKERS);
  return (
    <>
      {parts.map((part, i) => {
        // Text before a marker loses its trailing space so the superscript hugs the word.
        if (i % 2 === 0) return <Fragment key={i}>{i < parts.length - 1 ? part.replace(/\s+$/, "") : part}</Fragment>;
        const nums = [...part.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
        return (
          <sup key={i} className="ml-0.5 whitespace-nowrap text-[0.68em] font-semibold">
            [
            {nums.map((n, j) => (
              <Fragment key={n}>
                {j > 0 && ","}
                <a href={`#ref-${n}`} className="text-primary no-underline hover:underline" aria-label={`Reference ${n}`}>
                  {n}
                </a>
              </Fragment>
            ))}
            ]
          </sup>
        );
      })}
    </>
  );
}
