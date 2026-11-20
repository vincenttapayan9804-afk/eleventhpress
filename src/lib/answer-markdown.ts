/**
 * Applies `fn` to the parts of an answer's Markdown outside equations
 * ($$…$$) and fenced code blocks (```…```, e.g. a Mermaid diagram), so a
 * "[1]" inside one is never turned into a citation link.
 */
export function outsideMathAndCode(md: string, fn: (text: string) => string): string {
  return md
    .split(/(\$\$[\s\S]*?\$\$|```[\s\S]*?(?:```|$))/g)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}
