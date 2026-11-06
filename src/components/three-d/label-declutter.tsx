"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Screen-space label collision guard for drei <Html> labels.
 *
 * 3D labels are positioned by the camera, so no fixed layout can promise
 * they never collide: orbiting, zooming, a narrow phone canvas or a long
 * discipline name can all push two labels onto each other. This component
 * measures every label marked with `data-declutter="<priority>"` after the
 * camera settles and fades out any label that overlaps a higher-priority one
 * (ties go to the label rendered first), and any label that would be cut off
 * by the edge of the chart. Labels sharing a
 * `data-declutter-group` aren't tested against each other — used for rows of
 * rotated axis names whose axis-aligned boxes overlap while the text itself
 * doesn't.
 *
 * Mount it inside a <Canvas>.
 */
const PAD = 2;

export function LabelDeclutter() {
  const get = useThree((s) => s.get);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const run = () => {
      timer.current = null;
      // drei mounts <Html> into the element R3F listens on (the Canvas's
      // outer wrapper), falling back to the canvas's parent.
      const { events, gl } = get();
      const root = (events.connected as HTMLElement | undefined) ?? gl.domElement.parentElement;
      if (!root) return;
      const bounds = root.getBoundingClientRect();
      const els = Array.from(root.querySelectorAll<HTMLElement>("[data-declutter]"));
      const items = els
        .map((el, order) => {
          const r = el.getBoundingClientRect();
          return {
            el,
            order,
            priority: Number(el.dataset.declutter) || 0,
            group: el.dataset.declutterGroup ?? null,
            r,
          };
        })
        .sort((a, b) => b.priority - a.priority || a.order - b.order);
      const kept: typeof items = [];
      for (const it of items) {
        const empty = it.r.width === 0 || it.r.height === 0;
        const clipped =
          !empty &&
          (it.r.left < bounds.left - 1 ||
            it.r.right > bounds.right + 1 ||
            it.r.top < bounds.top - 1 ||
            it.r.bottom > bounds.bottom + 1);
        const clash =
          !empty &&
          (clipped ||
            kept.some(
            (k) =>
              (it.group === null || k.group !== it.group) &&
              it.r.left < k.r.right + PAD &&
              it.r.right + PAD > k.r.left &&
              it.r.top < k.r.bottom + PAD &&
              it.r.bottom + PAD > k.r.top
            ));
        it.el.style.transition = "opacity 150ms ease-out";
        it.el.style.opacity = clash ? "0" : "";
        if (!clash && !empty) kept.push(it);
      }
    };
    const schedule = () => {
      if (timer.current === null) timer.current = setTimeout(run, 60);
    };
    scheduleRef.current = schedule;
    schedule();
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      if (timer.current !== null) clearTimeout(timer.current);
      scheduleRef.current = null;
    };
  }, [get]);

  // Every rendered frame may move labels; re-check shortly after (a trailing
  // timer, so the final resting frame of a camera move is always measured).
  useFrame(() => scheduleRef.current?.());
  return null;
}

/** Spread onto a label's wrapper element. Higher priority wins a collision. */
export function declutterProps(priority: number, group?: string) {
  return group
    ? { "data-declutter": String(priority), "data-declutter-group": group }
    : { "data-declutter": String(priority) };
}
