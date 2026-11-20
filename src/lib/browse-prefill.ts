"use client";

/**
 * One-shot hand-off of a search query or discipline to the Articles page
 * (BrowseView), set just before switching to it — e.g. by the homepage
 * hero search or a discipline chip. Read and cleared once when BrowseView
 * mounts.
 *
 * (A `#q=` hash was used before, but the SPA's URL sync pushes the bare
 * `/articles` path on the view change, dropping the hash before BrowseView
 * could read it.)
 */
export interface BrowsePrefill {
  q?: string;
  discipline?: string;
}

let pending: BrowsePrefill | null = null;

export function setBrowsePrefill(prefill: BrowsePrefill) {
  pending = prefill;
}

export function takeBrowsePrefill(): BrowsePrefill | null {
  const p = pending;
  pending = null;
  return p;
}
