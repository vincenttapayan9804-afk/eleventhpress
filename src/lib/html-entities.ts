/** Decodes HTML character references (&amp;, &apos;, &#39;, &#x2019;, …) in plain text. Safe in the browser and on the server. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
    }
    const named: Record<string, string> = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
      lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", times: "×", plusmn: "±", deg: "°", micro: "µ", middot: "·",
      le: "≤", ge: "≥", ne: "≠", asymp: "≈", minus: "−", copy: "©", reg: "®", trade: "™", sect: "§", para: "¶",
      alpha: "α", beta: "β", gamma: "γ", delta: "δ", mu: "μ", sigma: "σ", chi: "χ", sup2: "²", sup3: "³", sup1: "¹",
    };
    return named[e.toLowerCase()] ?? m;
  });
}
