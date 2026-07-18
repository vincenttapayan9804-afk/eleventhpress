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
 *  - Each decorative scene shows a cheap gradient placeholder until (and if)
 *    its chunk loads, so a slow or WebGL-less device still gets a usable page.
 *  - Users with `prefers-reduced-motion` never load the 3D bundle at all.
 */
import dynamic from "next/dynamic";
import { Component, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

/** Cheap, dependency-free stand-in matching each scene's container footprint. */
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

/**
 * Isolates a single WebGL scene from the rest of the page — a failed
 * context (out of memory, no GPU, a driver quirk) falls back to the same
 * gradient placeholder instead of propagating up and tearing down
 * everything else on the page. React error boundaries must be class
 * components; there's no hook equivalent.
 */
class SceneErrorBoundary extends Component<{ className?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[three-d] scene failed, falling back:", error);
  }
  render() {
    if (this.state.failed) return <SceneFallback className={this.props.className} />;
    return this.props.children;
  }
}

/**
 * True on a client that hasn't asked to reduce motion. Uses
 * useSyncExternalStore (React's purpose-built API for reading external,
 * mutable browser state) rather than a useState+useEffect pair — that
 * pattern would call setState from inside an effect purely to get the
 * client's real value post-mount, which is both an anti-pattern and
 * unnecessary here since useSyncExternalStore already handles the
 * server/client snapshot split safely.
 */
function subscribeToMotionPreference(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getAllowMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function getAllowMotionServerSnapshot(): boolean {
  // Server/first-paint default: don't allow motion, so SSR (and the
  // client's first render, before hydration reconciles) renders the cheap
  // gradient fallback — matching this module's whole ssr:false posture of
  // never shipping the 3D bundle until a real client check wants it.
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
const KeywordClusterImpl = dynamic(() => import("./scenes").then((m) => m.KeywordCluster), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const MetricsBarChart3DImpl = dynamic(() => import("./scenes").then((m) => m.MetricsBarChart3D), {
  ssr: false,
  loading: () => <SceneFallback />,
});
const MetricsFillGauge3DImpl = dynamic(() => import("./scenes").then((m) => m.MetricsFillGauge3D), {
  ssr: false,
  loading: () => <SceneFallback />,
});

export function HeroGlobe(props: { className?: string }) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary className={props.className}>
      {allow ? <HeroGlobeImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
export function ImpactSphere(props: { className?: string }) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary className={props.className}>
      {allow ? <ImpactSphereImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
export function KeywordCluster(props: { keywords?: string[]; className?: string }) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary className={props.className}>
      {allow ? <KeywordClusterImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
export function MetricsBarChart3D(props: ComponentProps<typeof MetricsBarChart3DImpl>) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary className={props.className}>
      {allow ? <MetricsBarChart3DImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
export function MetricsFillGauge3D(props: ComponentProps<typeof MetricsFillGauge3DImpl>) {
  const allow = useAllowMotion();
  return (
    <SceneErrorBoundary className={props.className}>
      {allow ? <MetricsFillGauge3DImpl {...props} /> : <SceneFallback className={props.className} />}
    </SceneErrorBoundary>
  );
}
