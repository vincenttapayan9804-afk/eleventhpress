"use client";

import type { ReactNode } from "react";
import { useReveal } from "@/hooks/use-scroll-reveal";

/**
 * Defers mounting `children` until the wrapping element scrolls near the
 * viewport. Paired with a next/dynamic(ssr:false) child, this means the
 * child's JS chunk isn't even fetched — let alone its mount-time work
 * (polling, fetch-on-mount, etc.) run — until it's actually about to be
 * seen, rather than the instant its parent page/view renders.
 */
export function LazyOnVisible({ children, className }: { children: ReactNode; className?: string }) {
  const { observe, inView } = useReveal<HTMLDivElement>();
  return (
    <div ref={observe} className={className}>
      {inView ? children : null}
    </div>
  );
}
