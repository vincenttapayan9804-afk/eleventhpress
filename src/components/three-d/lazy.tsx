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
 *  - Purely decorative scenes (HeroGlobe/ImpactSphere) skip rendering
 *    entirely — falling back to the cheap static `SceneFallback` below —
 *    under `prefers-reduced-motion` OR a basic low-power/mobile capability
 *    check (any touch-primary device, or <=2 logical cores).
 *  - The data charts (the two metrics charts, and the browse page's
 *    discipline analytics) carry real numbers, so they never skip for
 *    `prefers-reduced-motion` and render in 3D on every device with working
 *    WebGL, phones and tablets included. Only a device without WebGL, or one
 *    whose context fails or is lost, gets their plain-CSS fallback (same
 *    numbers, no <Canvas>) — see DataSceneGuard.
 */
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import type { DisciplineAnalyticsSceneProps } from "./discipline-analytics-scene";

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
  const queries = [REDUCED_MOTION_QUERY, COARSE_POINTER_QUERY].map((q) => window.matchMedia(q));
  queries.forEach((mql) => mql.addEventListener("change", callback));
  return () => queries.forEach((mql) => mql.removeEventListener("change", callback));
}
/**
 * Basic capability check, beyond prefers-reduced-motion alone: any
 * touch-primary device, or a CPU with 2 or fewer logical cores, skips the
 * WebGL bundle outright rather than paying for a scene it's unlikely to
 * render smoothly. Touch alone (not touch AND a narrow viewport) is the
 * gate — logical CPU core count is a poor proxy for GPU quality (plenty
 * of real phones/tablets report 6-8 cores on a weak GPU), and a stalled
 * or silently-blank WebGL context on a real device doesn't throw, so
 * SceneErrorBoundary never catches it; the only reliable way to avoid
 * that failure mode for the metrics charts (which carry real numbers,
 * not decoration) is to never attempt WebGL on touch input at all,
 * regardless of screen size. navigator.hardwareConcurrency doesn't
 * change at runtime, so it only needs reading once per snapshot, not a
 * subscription of its own.
 */
function isLowPowerDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  const isTouchPrimary = window.matchMedia(COARSE_POINTER_QUERY).matches;
  const lowCores =
    typeof navigator !== "undefined" &&
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 2;
  return isTouchPrimary || lowCores;
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

/**
 * WebGL capability probe for the data charts. Earlier these charts skipped
 * WebGL on every touch-primary device, which meant phones and tablets never
 * saw the 3D graphs at all. Now any device that can actually create a WebGL
 * context gets them (the scenes drop to a lower pixel ratio on touch screens
 * to save GPU memory), and the plain-DOM fallback is kept for devices with
 * no WebGL, or whose context is lost while rendering (see DataSceneGuard).
 * The probe runs once per page load and releases its test context at once.
 */
let webglProbe: boolean | null = null;
function probeWebGL(): boolean {
  if (webglProbe !== null) return webglProbe;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    webglProbe = !!gl && !gl.isContextLost();
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}
const subscribeNoop = () => () => {};
function useWebGLAvailable() {
  return useSyncExternalStore(subscribeNoop, probeWebGL, () => false);
}

/**
 * Error boundary + context-loss watcher around one data scene. A thrown
 * render error is caught by SceneErrorBoundary; a GPU that drops the context
 * mid-session (common on memory-starved phones) fires `webglcontextlost`
 * on the canvas, which doesn't bubble, so it's caught here in the capture
 * phase. Either way the reader gets the same numbers as plain DOM.
 */
export function DataSceneGuard({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const webgl = useWebGLAvailable();
  const [lost, setLost] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLost = () => setLost(true);
    el.addEventListener("webglcontextlost", onLost, true);
    return () => el.removeEventListener("webglcontextlost", onLost, true);
  }, [webgl]);
  if (!webgl || lost) return <>{fallback}</>;
  return (
    <div ref={ref} className="contents">
      <SceneErrorBoundary fallback={fallback}>{children}</SceneErrorBoundary>
    </div>
  );
}

const HeroGlobeImpl = dynamic(() => import("./scenes").then((m) => m.HeroGlobe), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const ImpactSphereImpl = dynamic(() => import("./scenes").then((m) => m.ImpactSphere), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const DisciplineAnalyticsSceneImpl = dynamic(
  () => import("./discipline-analytics-scene").then((m) => m.DisciplineAnalyticsScene),
  { ssr: false, loading: () => <div className="h-full w-full shimmer rounded-xl" /> }
);
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
/**
 * The browse page's discipline analytics. Carries real numbers, so it never
 * skips for reduced motion (the scene only stops animating) and renders in
 * 3D on every device with working WebGL — phones included. No WebGL, a
 * render error or a lost context all get `fallback`: a plain-DOM chart of
 * the same data, never a blank box.
 */
export function DisciplineAnalyticsScene({
  fallback,
  ...props
}: DisciplineAnalyticsSceneProps & { fallback: ReactNode }) {
  return (
    <DataSceneGuard fallback={fallback}>
      <DisciplineAnalyticsSceneImpl {...props} />
    </DataSceneGuard>
  );
}
export function MetricsBarChart3D(props: ComponentProps<typeof MetricsBarChart3DImpl>) {
  return (
    <DataSceneGuard fallback={<MetricsBarChartFallback items={props.items} className={props.className} />}>
      <MetricsBarChart3DImpl {...props} />
    </DataSceneGuard>
  );
}
export function MetricsFillGauge3D(props: ComponentProps<typeof MetricsFillGauge3DImpl>) {
  return (
    <DataSceneGuard fallback={<MetricsFillGaugeFallback items={props.items} className={props.className} />}>
      <MetricsFillGauge3DImpl {...props} />
    </DataSceneGuard>
  );
}
