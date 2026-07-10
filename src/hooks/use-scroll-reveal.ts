"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useReveal — IntersectionObserver-based scroll trigger.
 * Returns `observe` (a callback ref) to attach to any element and `inView` state.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: { threshold?: number; rootMargin?: string } = {}) {
  const [inView, setInView] = useState(false);

  const observe = useCallback((node: T | null) => {
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? "0px 0px -60px 0px" }
    );
    obs.observe(node);
  }, [options.threshold, options.rootMargin]);

  return { observe, inView };
}
