import sanitizeHtml from "sanitize-html";

/**
 * Shared sanitization for editorial-staff-authored rich-text HTML
 * (MagazinePiece.bodyHtml, MediaPost.bodyHtml) before it's persisted —
 * same allowlist src/lib/galley.ts already applies to manuscript content,
 * duplicated here rather than imported so these routes don't pull in
 * galley.ts's unrelated server-only dependencies (pdfkit, epub-builder).
 * A compromised editorial account, or a bug in whatever rich-text editor
 * produced this HTML, is otherwise a stored-XSS vector against every
 * reader — PRIVILEGED_ROLES-gated authorship doesn't make raw HTML safe
 * to render verbatim via dangerouslySetInnerHTML.
 */
const EDITORIAL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
    "strong", "b", "em", "i", "u", "s", "br", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
    "blockquote", "a", "sup", "sub", "code", "pre", "figure", "figcaption", "img",
  ],
  allowedAttributes: { a: ["href"], img: ["src", "alt"] },
  allowedSchemes: ["http", "https", "mailto"],
};

export function sanitizeEditorialHtml(html: string): string {
  return sanitizeHtml(html, EDITORIAL_SANITIZE_OPTIONS);
}
