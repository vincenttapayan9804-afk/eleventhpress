/**
 * The fixed platform credit every whitelabel tenant carries — on its site
 * footer, in its emails and on every document it generates. Hardcoded on
 * purpose: it is not a branding setting, so no tenant can edit or remove
 * it. The platform's own site and documents don't show it (they are
 * already Eleventh Press's). Safe to import from client components.
 */
export const POWERED_BY_CREDIT = "Powered by Eleventh Press International Publishing";
export const POWERED_BY_URL = "https://eleventhpress.org";

/** The credit for a document/page, or null when it belongs to the platform itself. */
export function poweredByFor(id: { whitelabel: boolean } | null | undefined): string | null {
  return id?.whitelabel ? POWERED_BY_CREDIT : null;
}
