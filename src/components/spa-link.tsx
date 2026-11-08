"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { pathForState, type RouteState } from "@/lib/spa-routes";

/**
 * A real link to a page of the single-page site: it has an href (so it can
 * be opened in a new tab, copied or middle-clicked) while an ordinary
 * click switches the view in place via `onNavigate`.
 */
export function SpaLink({
  to,
  onNavigate,
  onClick,
  ...rest
}: { to: RouteState; onNavigate: () => void } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href = pathForState(to) ?? "/";
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate();
  };
  return <a href={href} onClick={handle} {...rest} />;
}
