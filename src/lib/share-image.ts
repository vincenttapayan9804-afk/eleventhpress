/**
 * The site-wide share image (src/app/opengraph-image.tsx, served at
 * /opengraph-image, resolved against metadataBase).
 *
 * Next.js only inherits a parent's file-based Open Graph image while a page
 * leaves `openGraph` alone: any page that sets its own `openGraph` (to give
 * it a page-specific title, URL or type) replaces the whole object, image
 * included. That left every section page, guide, blog post and form without
 * an og:image or twitter:image, so links to them shared as bare text cards.
 * Pages that set `openGraph`/`twitter` themselves spread these in.
 */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Eleventh Press International Publishing",
} as const;

export const SHARE_IMAGES = [SHARE_IMAGE];
