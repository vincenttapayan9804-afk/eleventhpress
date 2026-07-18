"use client";

/**
 * Chart/motion primitives for the Overview tab's "Aurora" grade (Grade 03
 * of the glass/motion style preview). Every chart here is fed real data
 * already present in the /api/dashboard payload — no new network calls,
 * no charting dependency. Entrance/draw-in animation uses a single
 * post-mount reveal flag (CSS transition, not a rAF loop) so idle cost is
 * zero; cursor-tilt mutates the DOM directly via a ref instead of React
 * state so pointermove never triggers a re-render.
 */
import { useEffect, useMemo, useRef, useState } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True one frame after mount (or immediately under reduced motion) — flips CSS transitions/animations on. */
export function useReveal(): boolean {
  const [revealed, setRevealed] = useState(REDUCED_MOTION);
  useEffect(() => {
    if (REDUCED_MOTION) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return revealed;
}

/** Counts up from 0 to `target` once on mount. Skips straight to `target` under reduced motion. */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(REDUCED_MOTION ? target : 0);
  useEffect(() => {
    if (REDUCED_MOTION) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Cursor-tilt for Aurora cards — direct style mutation on a ref, no re-renders on pointermove. */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || REDUCED_MOTION) return;
    const onMove = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = `perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translateY(-6px)`;
    };
    const onLeave = () => { node.style.transform = ""; };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return ref;
}

/** Ambient drifting background — mount once per Overview render, sits behind the first card row. */
export function AuroraField() {
  return (
    <div className="aurora-field" aria-hidden="true">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
    </div>
  );
}

const ORD = ["var(--royal-200)", "var(--royal-300)", "var(--royal-400)", "var(--royal-500)", "var(--royal-700)"];

export interface FunnelStage { label: string; value: number }

/** Ordinal horizontal stage bar — Submitted → … → Published, one hue, monotone lightness. */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const revealed = useReveal();
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div>
      {stages.map((s, i) => {
        const pct = Math.max(6, (s.value / max) * 100);
        return (
          <div key={s.label} className="grid grid-cols-[92px_1fr_60px] items-center gap-2.5 py-1.5 text-sm">
            <span className="truncate text-xs font-medium">{s.label}</span>
            <span className="h-[18px] overflow-hidden rounded-md bg-muted/50">
              <span
                className="block h-full rounded-md transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: revealed ? `${pct}%` : "0%",
                  background: ORD[Math.min(i, ORD.length - 1)],
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            </span>
            <span className="text-right font-mono text-[0.7rem] text-muted-foreground">{s.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface RankItem { label: string; value: number }

/** Ranked horizontal bars (e.g. reviewer workload) — magnitude by rank, same ordinal ramp. */
export function RankBarList({ items }: { items: RankItem[] }) {
  const revealed = useReveal();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      {items.map((it, i) => {
        const pct = Math.max(6, (it.value / max) * 100);
        return (
          <div key={it.label} className="grid grid-cols-[120px_1fr_28px] items-center gap-2.5 py-1.5 text-sm">
            <span className="truncate text-xs font-medium">{it.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted/50">
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: revealed ? `${pct}%` : "0%",
                  background: ORD[Math.min(i, ORD.length - 1)],
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            </span>
            <span className="text-right font-mono text-[0.7rem] text-muted-foreground">{it.value}</span>
          </div>
        );
      })}
      {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nothing assigned yet.</p>}
    </div>
  );
}

export interface DonutSlice { label: string; value: number; color: string }

/** Donut with hover tooltip. `color` should be a status/semantic token, not a nominal hue, when slices mean good/bad. */
export function OutcomeDonut({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: string }) {
  const revealed = useReveal();
  const [hover, setHover] = useState<number | null>(null);
  const total = Math.max(1, slices.reduce((a, s) => a + s.value, 0));
  const size = 128, r = 46, cx = size / 2, cy = size / 2, sw = 17;
  const circ = 2 * Math.PI * r;
  const geometry = useMemo(
    () =>
      slices.reduce<Array<DonutSlice & { dash: number; off: number }>>((rows, s) => {
        const dash = (s.value / total) * circ;
        const prev = rows[rows.length - 1];
        const off = prev ? prev.off + prev.dash : 0;
        return [...rows, { ...s, dash, off }];
      }, []),
    [slices, total, circ]
  );

  if (total === 0 || slices.every((s) => s.value === 0)) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Nothing to show yet.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-[128px] flex-shrink-0 overflow-visible">
        {geometry.map((s, i) => {
          const dashArray = revealed ? `${s.dash} ${circ - s.dash}` : `0 ${circ}`;
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === i ? sw + 4 : sw}
              strokeDasharray={dashArray}
              strokeDashoffset={-s.off}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 650ms cubic-bezier(0.16,1,0.3,1), stroke-width 150ms ease" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          );
        })}
        <text x={cx} y={cy - 1} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)">
          {hover !== null ? slices[hover].value : total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">
          {hover !== null ? slices[hover].label : centerLabel}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 text-xs">
        {slices.map((s, i) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-muted-foreground"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
            {s.label} — <b className="text-foreground">{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface WorkloadItem { label: string; sub: string; status: "good" | "warn" | "critical" }

/** Due-date-urgency list (reviewer workload). Status color is reserved semantic meaning, always icon + label. */
export function WorkloadList({ items }: { items: WorkloadItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No active assignments.</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.label}</span>
          <span
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
            style={{
              color: it.status === "critical" ? "var(--destructive)" : it.status === "warn" ? "var(--status-warn)" : "var(--status-good)",
              background: it.status === "critical" ? "var(--status-critical-bg)" : it.status === "warn" ? "var(--status-warn-bg)" : "var(--status-good-bg)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: it.status === "critical" ? "var(--destructive)" : it.status === "warn" ? "var(--status-warn)" : "var(--status-good)" }}
            />
            {it.sub}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Aurora-styled stat tile: count-up number + delta, staggered entrance. */
export function AuroraStat({
  icon: Icon,
  label,
  value,
  index = 0,
}: {
  icon: any;
  label: string;
  value: number | string;
  index?: number;
}) {
  const numeric = typeof value === "number";
  const counted = useCountUp(numeric ? (value as number) : 0);
  const tiltRef = useTilt<HTMLDivElement>();
  return (
    <div
      ref={tiltRef}
      className="paper-card aurora-card aurora-enter p-5"
      style={{ "--aurora-delay": `${index * 70}ms` } as React.CSSProperties}
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{numeric ? counted : value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
