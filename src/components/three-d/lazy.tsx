"use client";

/**
 * Lazy, SSR-disabled wrappers around the heavy Three.js scenes in
 * ./scenes.tsx. The scenes module statically imports @react-three/fiber,
 * @react-three/drei and three — hundreds of KB of JS plus a live WebGL/GPU
 * context per <Canvas>. Importing any scene directly (as home/browse/article
 * views used to) pulled all of that into those pages' initial bundle and
 * initialised multiple WebGL contexts the moment the page mounted, which
 * on a memory-constrained device can exhaust the tab and crash the render
 * ("This page couldn't load") even though the server returned a clean 200.
 *
 * Routing every view through this module instead means:
 *  - Three.js becomes a separate async chunk, fetched only on the client
 *    AFTER the page is interactive (ssr: false) — the content paints first.
 *  - Each scene shows a fallback until (and if) its chunk loads, so a slow
 *    or WebGL-less device still gets a usable page — and for the two
 *    metrics charts, which carry real numbers rather than decoration, that
 *    fallback is a plain CSS rendering of the same data, not a blank box.
 *  - Purely decorative scenes (HeroGlobe/ImpactSphere) also respect
 *    `prefers-reduced-motion`, and a basic low-power/mobile capability
 *    check (small touch viewport or <=2 logical cores), by not rendering
 *    at all — falling back to the cheap static `SceneFallback` below
 *    instead; the data-bearing
 *    scenes — the two metrics charts and DisciplineTowers — don't skip
 *    loading for that (their animation, if any, is a barely-perceptible
 *    bob) — hiding real numbers behind a motion preference would remove
 *    information, not just motion.
 */
import dynamic from "next/dynamic";
import { Component, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import type { DisciplineStat } from "./scenes";

/** Cheap, dependency-free stand-in matching each scene's container footprint — used only for the purely decorative scenes, where losing the content isn't losing information. */
function SceneFallback({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={
        "h-full w-full rounded-[inherit] bg-gradient-to-br from-[oklch(0.62_0.19_295/0.35)] via-[oklch(0.52_0.2_296/0.25)] to-[oklch(0.42_0.16_294/0.35)] " +
        className
      }
    />
  );
}

interface MetricBarDatum {
  label: string;
  value: number;
  color: string;
}
interface MetricGaugeDatum {
  label: string;
  value: number | null;
  color: string;
}

/** Plain-CSS bar chart carrying the exact same data as MetricsBarChart3D — same sqrt scale, so relative bar heights match the 3D version. Renders whenever the 3D chunk hasn't loaded yet or failed outright, so the numbers are never simply missing. */
function MetricsBarChartFallback({ items, className = "" }: { items: MetricBarDatum[]; className?: string }) {
  const magnitudes = items.map((it) => Math.sqrt(Math.max(it.value, 0)));
  const max = Math.max(...magnitudes, 1);
  return (
    <div className={`flex h-full flex-col justify-end gap-2 px-2 pb-1 ${className}`}>
      <div className="flex min-h-0 flex-1 items-end justify-center gap-2">
        {items.map((it, i) => (
          <div key={it.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[0.65rem] font-semibold" style={{ color: it.color }}>
              {it.value.toLocaleString()}
            </span>
            <div
              className="w-full max-w-8 rounded-t-sm"
              style={{
                height: `${Math.max((magnitudes[i] / max) * 100, 4)}%`,
                background: it.color,
                opacity: 0.85,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex shrink-0 justify-center gap-0.5 px-1 pt-1">
        {items.map((it) => (
          <p key={it.label} className="flex-1 px-0.5 text-center text-[0.58rem] font-medium leading-[1.15]" style={{ color: it.color }} title={it.label}>
            {it.label}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Plain-CSS fill gauge carrying the exact same data as MetricsFillGauge3D — a null value renders as an empty/dim tube rather than a fabricated fill level, matching the 3D version's honesty. */
function MetricsFillGaugeFallback({ items, className = "" }: { items: MetricGaugeDatum[]; className?: string }) {
  return (
    <div className={`flex h-full flex-col justify-end gap-2 px-2 pb-1 ${className}`}>
      <div className="flex min-h-0 flex-1 items-end justify-center gap-4">
        {items.map((it) => {
          const pct = Math.max(0, Math.min(100, it.value ?? 0));
          return (
            <div key={it.label} className="flex h-full w-10 flex-col items-center justify-end">
              <span className="mb-1 text-[0.65rem] font-semibold" style={{ color: it.value != null ? it.color : "var(--muted-foreground)" }}>
                {it.value != null ? `${Math.round(it.value)}%` : "—"}
              </span>
              <div className="relative h-full w-6 overflow-hidden rounded-full bg-black/10">
                {it.value != null && (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-full"
                    style={{ height: `${pct}%`, background: it.color, opacity: 0.85 }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 justify-center gap-0.5 px-1 pt-1">
        {items.map((it) => (
          <p key={it.label} className="flex-1 px-0.5 text-center text-[0.58rem] font-medium leading-[1.15]" style={{ color: it.value != null ? it.color : "var(--muted-foreground)" }} title={it.label}>
            {it.label}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Isolates a single WebGL scene from the rest of the page — a failed
 * context (out of memory, no GPU, a driver quirk) falls back to `fallback`
 * instead of propagating up and tearing down everything else on the page.
 * React error boundaries must be class components; there's no hook
 * equivalent.
 */
class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[three-d] scene failed, falling back:", error);
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SMALL_VIEWPORT_QUERY = "(max-width: 640px)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

/**
 * True on a client that hasn't asked to reduce motion AND isn't a
 * low-power/mobile device. Uses useSyncExternalStore (React's
 * purpose-built API for reading external, mutable browser state) rather
 * than a useState+useEffect pair — that pattern would call setState from
 * inside an effect purely to get the client's real value post-mount,
 * which is both an anti-pattern and unnecessary here since
 * useSyncExternalStore already handles the server/client snapshot split
 * safely. Only consulted by the purely decorative scenes below — the two
 * metrics charts always attempt to load regardless, since they carry real
 * data rather than decoration.
 */
function subscribeToMotionPreference(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const queries = [REDUCED_MOTION_QUERY, SMALL_VIEWPORT_QUERY, COARSE_POINTER_QUERY].map((q) => window.matchMedia(q));
  queries.forEach((mql) => mql.addEventListener("change", callback));
  return () => queries.forEach((mql) => mql.removeEventListener("change", callback));
}
/**
 * Basic capability check, beyond prefers-reduced-motion alone: a touch
 * device with a phone-sized viewport, or a CPU with 2 or fewer logical
 * cores, skips the WebGL bundle outright rather than paying for a scene
 * it's unlikely to render smoothly. navigator.hardwareConcurrency doesn't
 * change at runtime, so it only needs reading once per snapshot, not a
 * subscription of its own.
 */
function isLowPowerDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  const isPhoneSizedTouch = window.matchMedia(SMALL_VIEWPORT_QUERY).matches && window.matchMedia(COARSE_POINTER_QUERY).matches;
  const lowCores =
    typeof navigator !== "undefined" &&
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 2;
  return isPhoneSizedTouch || lowCores;
}
function getAllowMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
  return !isLowPowerDevice();
}
function getAllowMotionServerSnapshot(): boolean {
  // Server/first-paint default: don't allow motion, so SSR (and the
  // client's first render, before hydration reconciles) renders the cheap
  // fallback — matching this module's whole ssr:false posture of never
  // shipping the 3D bundle until a real client check wants it.
  return false;
}
function useAllowMotion() {
  return useSyncExternalStore(subscribeToMotionPreference, getAllowMotionSnapshot, getAllowMotionServerSnapshot);
}

const HeroGlobeImpl = dynamic(() => import("./scenes").then((m) => m.HeroGlobe), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const ImpactSphereImpl = dynamic(() => import("./scenes").then((m) => m.ImpactSphere), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const DisciplineTowersImpl = dynamic(() => import("./scenes").then((m) => m.DisciplineTowers), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const MetricsBarChart3DImpl = dynamic(() => import("./scenes").then((m) => m.MetricsBarChart3D), {
  ssr: false,
  loading: () => null,
});
const MetricsFillGauge3DImpl = dynamic(() => import("./scenes").then((m) => m.MetricsFillGauge3D), {
  ssr: false,
  loading: () => null,
});

export function HeroGlobe(props: { className?: string }) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary fallback={<SceneFallback className={props.className} />}>
      {allow ? <HeroGlobeImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
export function ImpactSphere(props: { className?: string }) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary fallback={<SceneFallback className={props.className} />}>
      {allow ? <ImpactSphereImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
export function DisciplineTowers(props: { stats: DisciplineStat[]; className?: string }) {
  // Explicitly user-invoked (the browse page's "3D Analytics" toggle), not
  // ambient decoration like HeroGlobe/ImpactSphere — so this always
  // attempts to render rather than substituting the fallback outright
  // under prefers-reduced-motion. Only the animation inside the scene
  // itself is gated; see DisciplineTowers in ./scenes.tsx.
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary fallback={<SceneFallback className={props.className} />}>
      <DisciplineTowersImpl {...props} allowMotion={allow} />
    </SceneErrorBoundary>
  );
}
export function MetricsBarChart3D(props: ComponentProps<typeof MetricsBarChart3DImpl>) {
  return (
    <SceneErrorBoundary fallback={<MetricsBarChartFallback items={props.items} className={props.className} />}>
      <MetricsBarChart3DImpl {...props} />
    </SceneErrorBoundary>
  );
}
export function MetricsFillGauge3D(props: ComponentProps<typeof MetricsFillGauge3DImpl>) {
  return (
    <SceneErrorBoundary fallback={<MetricsFillGaugeFallback items={props.items} className={props.className} />}>
      <MetricsFillGauge3DImpl {...props} />
    </SceneErrorBoundary>
  );
}
