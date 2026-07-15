"use client";

import Script from "next/script";
import { altmetricBadgeProps, plumxBadgeProps } from "@/lib/attention-metrics";

/**
 * Real, unauthenticated vendor embeds — each script scans the page for its
 * own marker element/class and fetches live attention data for the given
 * DOI directly from the vendor. No API key, no simulation path: a DOI with
 * no tracked attention yet will simply render an empty/zero badge, which is
 * the honest result.
 */

export function AltmetricBadge({ doi }: { doi: string }) {
  return (
    <>
      <Script
        id="altmetric-embed-script"
        src="https://d1bxh8uas1mnw7.cloudfront.net/assets/embed.js"
        strategy="lazyOnload"
      />
      <div {...altmetricBadgeProps(doi)} />
    </>
  );
}

export function PlumXBadge({ doi }: { doi: string }) {
  return (
    <>
      <Script
        id="plumx-embed-script"
        src="https://cdn.plu.mx/widget-popup.js"
        strategy="lazyOnload"
      />
      <a href={`https://plu.mx/plum/a/?doi=${encodeURIComponent(doi)}`} {...plumxBadgeProps(doi)} />
    </>
  );
}
