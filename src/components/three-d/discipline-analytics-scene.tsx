"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, ContactShadows, Html, Line, OrbitControls, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CHART_THEME,
  METRICS,
  formatCompact,
  niceTicks,
  shortDisciplineName,
  type AnalyticsMetric,
  type AnalyticsView,
  type DisciplineStat,
} from "./discipline-analytics-shared";

type Theme = { [K in keyof (typeof CHART_THEME)["light"]]: string };

export interface CameraApi {
  zoomBy: (factor: number) => void;
  reset: () => void;
}

export interface DisciplineAnalyticsSceneProps {
  stats: DisciplineStat[];
  view: AnalyticsView;
  metric: AnalyticsMetric;
  /** Hovered in the chart or focused/hovered in the table. */
  highlighted: string | null;
  /** The browse page's active discipline filter, if any. */
  selected: string | null;
  onHover: (discipline: string | null, pointer?: { x: number; y: number }) => void;
  onSelect: (discipline: string) => void;
  allowMotion: boolean;
  dark: boolean;
  /** Receives zoom/reset controls once the camera is ready (null on unmount). */
  onCameraApi: (api: CameraApi | null) => void;
  className?: string;
}

// Keeps drei's DOM labels under the browse page's sticky filter bar (z-30)
// and the tooltip/dialog layers, instead of drei's default ~16M z-index.
const LABEL_Z: [number, number] = [20, 0];
const BAR_W = 0.6;
const BAR_SPACING = 1.1;
const BAR_MAX_H = 3;
const BOX = { half: 2.2, height: 3 };

function Label({
  position,
  children,
  transform = "translate(-50%, -50%)",
}: {
  position: [number, number, number];
  children: ReactNode;
  transform?: string;
}) {
  return (
    <Html position={position} zIndexRange={LABEL_Z} style={{ pointerEvents: "none" }}>
      <div style={{ transform, transformOrigin: "100% 0" }} className="whitespace-nowrap">
        {children}
      </div>
    </Html>
  );
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-background/95 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground shadow-sm">
      {children}
    </span>
  );
}

function usePointerHandlers(
  discipline: string,
  onHover: DisciplineAnalyticsSceneProps["onHover"],
  onSelect: DisciplineAnalyticsSceneProps["onSelect"]
) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
      onHover(discipline, { x: e.clientX, y: e.clientY });
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(discipline, { x: e.clientX, y: e.clientY });
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
      onHover(null);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // A drag that orbits the camera also ends in a click — only a
      // near-stationary press counts as "select".
      if (e.delta > 4) return;
      onSelect(discipline);
    },
  };
}

/** One draw call for a whole set of hairline grid segments. */
function GridLines({ segments, color }: { segments: [number, number, number][]; color: string }) {
  if (segments.length === 0) return null;
  return <Line points={segments} segments color={color} lineWidth={1} />;
}

// ─── Ranked 3D bars ──────────────────────────────────────────────────────

function Bar({
  x,
  height,
  theme,
  dim,
  emphasized,
  indexed,
  allowMotion,
  handlers,
}: {
  x: number;
  height: number;
  theme: Theme;
  dim: boolean;
  emphasized: boolean;
  indexed: boolean;
  allowMotion: boolean;
  handlers: ReturnType<typeof usePointerHandlers>;
}) {
  const body = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const capMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const shown = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
  }, [height, dim, emphasized, theme, invalidate]);

  useFrame((_, dt) => {
    let moving = false;
    const next = allowMotion ? THREE.MathUtils.damp(shown.current, height, 6, dt) : height;
    shown.current = Math.abs(next - height) < 1e-3 ? height : next;
    if (shown.current !== height) moving = true;
    const h = Math.max(shown.current, 0.02);
    if (body.current) body.current.scale.y = h;
    if (cap.current) cap.current.position.y = h;

    const targetOpacity = dim ? 0.24 : 1;
    const targetGlow = emphasized ? 0.35 : 0;
    for (const m of [bodyMat.current, capMat.current]) {
      if (!m) continue;
      const o = allowMotion ? THREE.MathUtils.damp(m.opacity, targetOpacity, 12, dt) : targetOpacity;
      const g = allowMotion ? THREE.MathUtils.damp(m.emissiveIntensity, targetGlow, 12, dt) : targetGlow;
      if (Math.abs(o - targetOpacity) > 1e-3 || Math.abs(g - targetGlow) > 1e-3) moving = true;
      m.opacity = o;
      m.emissiveIntensity = g;
    }
    if (moving) invalidate();
  });

  return (
    <group position={[x, 0, 0]}>
      <group ref={body}>
        <mesh position={[0, 0.5, 0]} {...handlers}>
          <boxGeometry args={[BAR_W, 1, BAR_W]} />
          <meshPhysicalMaterial
            ref={bodyMat}
            color={theme.mark}
            emissive={theme.mark}
            emissiveIntensity={0}
            roughness={0.38}
            metalness={0.05}
            clearcoat={0.85}
            clearcoatRoughness={0.25}
            transparent
          />
        </mesh>
      </group>
      {/* Rounded data-end: a thin bevelled cap riding on the bar's top. */}
      <group ref={cap}>
        <RoundedBox args={[BAR_W, 0.06, BAR_W]} radius={0.025} smoothness={3} position={[0, 0, 0]} {...handlers}>
          <meshPhysicalMaterial
            ref={capMat}
            color={theme.mark}
            emissive={theme.mark}
            emissiveIntensity={0}
            roughness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.15}
            transparent
          />
        </RoundedBox>
      </group>
      {indexed && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <ringGeometry args={[0.45, 0.49, 48]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={dim ? 0.3 : 0.95} />
        </mesh>
      )}
    </group>
  );
}

function BarsScene({
  stats,
  metric,
  highlighted,
  selected,
  onHover,
  onSelect,
  allowMotion,
  theme,
}: Omit<DisciplineAnalyticsSceneProps, "view" | "dark" | "onCameraApi" | "className"> & { theme: Theme }) {
  const def = METRICS[metric];
  const ranked = useMemo(
    () => [...stats].sort((a, b) => def.value(b) - def.value(a) || a.discipline.localeCompare(b.discipline)),
    [stats, def]
  );
  const ticks = useMemo(() => niceTicks(Math.max(...ranked.map(def.value), 0)), [ranked, def]);
  const top = ticks[ticks.length - 1];
  const x0 = -((ranked.length - 1) * BAR_SPACING) / 2;
  const x1 = -x0;
  const axisX = x0 - BAR_SPACING * 0.75;
  const wallZ = -0.75;
  const focus = highlighted ?? selected;

  const gridSegments = useMemo(() => {
    const segs: [number, number, number][] = [];
    for (const t of ticks) {
      const y = (t / top) * BAR_MAX_H;
      segs.push([axisX, y, wallZ], [x1 + BAR_SPACING * 0.6, y, wallZ]);
    }
    segs.push([axisX, 0, wallZ], [axisX, BAR_MAX_H, wallZ]);
    return segs;
  }, [ticks, top, axisX, x1]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, -0.05]}>
        <planeGeometry args={[x1 - x0 + BAR_SPACING * 2.4, 2.1]} />
        <meshStandardMaterial color={theme.floor} roughness={0.9} transparent opacity={0.85} />
      </mesh>
      <GridLines segments={gridSegments} color={theme.grid} />

      {ticks.map((t) => (
        <Label key={t} position={[axisX - 0.12, (t / top) * BAR_MAX_H, wallZ]} transform="translate(-100%, -50%)">
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatCompact(t)}</span>
        </Label>
      ))}
      <Label position={[axisX, BAR_MAX_H + 0.42, wallZ]} transform="translate(-50%, -50%)">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{def.axisTitle}</span>
      </Label>

      {ranked.map((s, i) => {
        const value = def.value(s);
        const x = x0 + i * BAR_SPACING;
        const height = (value / top) * BAR_MAX_H;
        const emphasized = focus === s.discipline;
        // Selective direct labels: the emphasized bar, plus the leader when
        // nothing is emphasized. Every other value lives in the tooltip and
        // the table beside the chart.
        const showValue = emphasized || (!focus && i === 0);
        return (
          <group key={s.discipline}>
            <BarWithHandlers
              stat={s}
              x={x}
              height={height}
              theme={theme}
              dim={!!focus && !emphasized}
              emphasized={emphasized}
              allowMotion={allowMotion}
              onHover={onHover}
              onSelect={onSelect}
            />
            {showValue && (
              <Label position={[x, height + 0.32, 0]}>
                <ValueBadge>{def.format(value)}</ValueBadge>
              </Label>
            )}
            <Label position={[x + 0.12, 0, 0.45]} transform="translate(-100%, 0) rotate(-38deg)">
              <span
                className={`text-[11px] ${emphasized ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}
              >
                {shortDisciplineName(s.discipline)}
              </span>
            </Label>
          </group>
        );
      })}

      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={x1 - x0 + 4} blur={2.4} far={3.5} color={theme.shadow} />
    </group>
  );
}

function BarWithHandlers({
  stat,
  onHover,
  onSelect,
  ...rest
}: Omit<Parameters<typeof Bar>[0], "handlers" | "indexed"> & {
  stat: DisciplineStat;
  onHover: DisciplineAnalyticsSceneProps["onHover"];
  onSelect: DisciplineAnalyticsSceneProps["onSelect"];
}) {
  const handlers = usePointerHandlers(stat.discipline, onHover, onSelect);
  return <Bar {...rest} indexed={stat.indexed} handlers={handlers} />;
}

// ─── 3D correlation scatter ──────────────────────────────────────────────

function Point({
  stat,
  position,
  theme,
  dim,
  emphasized,
  showName,
  allowMotion,
  onHover,
  onSelect,
}: {
  stat: DisciplineStat;
  position: [number, number, number];
  theme: Theme;
  dim: boolean;
  emphasized: boolean;
  showName: boolean;
  allowMotion: boolean;
  onHover: DisciplineAnalyticsSceneProps["onHover"];
  onSelect: DisciplineAnalyticsSceneProps["onSelect"];
}) {
  const handlers = usePointerHandlers(stat.discipline, onHover, onSelect);
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const grown = useRef(allowMotion ? 0 : 1);
  const invalidate = useThree((s) => s.invalidate);
  const [x, y, z] = position;

  useEffect(() => {
    invalidate();
  }, [dim, emphasized, theme, invalidate]);

  useFrame((_, dt) => {
    let moving = false;
    const scaleTarget = emphasized ? 1.35 : 1;
    const g = allowMotion ? THREE.MathUtils.damp(grown.current, scaleTarget, 8, dt) : scaleTarget;
    grown.current = Math.abs(g - scaleTarget) < 1e-3 ? scaleTarget : g;
    if (grown.current !== scaleTarget) moving = true;
    group.current?.scale.setScalar(grown.current);
    if (mat.current) {
      const o = dim ? 0.25 : 1;
      mat.current.opacity = allowMotion ? THREE.MathUtils.damp(mat.current.opacity, o, 12, dt) : o;
      if (Math.abs(mat.current.opacity - o) > 1e-3) moving = true;
    }
    if (moving) invalidate();
  });

  return (
    <group>
      {/* Drop line + floor footprint — the depth cues that make a 3D
          scatter readable instead of a cloud of floating dots. */}
      <Line points={[[x, y, z], [x, 0, z]]} color={theme.mark} lineWidth={1} transparent opacity={dim ? 0.12 : 0.4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, z]}>
        <circleGeometry args={[0.09, 32]} />
        <meshBasicMaterial color={theme.mark} transparent opacity={dim ? 0.08 : 0.22} />
      </mesh>
      <group ref={group} position={[x, y, z]}>
        <mesh>
          <sphereGeometry args={[0.13, 32, 32]} />
          <meshPhysicalMaterial
            ref={mat}
            color={theme.mark}
            emissive={theme.mark}
            emissiveIntensity={emphasized ? 0.35 : 0.05}
            roughness={0.3}
            clearcoat={1}
            clearcoatRoughness={0.2}
            transparent
          />
        </mesh>
        {stat.indexed && (
          <Billboard>
            <mesh>
              <ringGeometry args={[0.19, 0.225, 48]} />
              <meshBasicMaterial color={theme.accent} transparent opacity={dim ? 0.3 : 0.95} side={THREE.DoubleSide} />
            </mesh>
          </Billboard>
        )}
        {/* Hit target ≥ 24px around an ~8px-radius mark. */}
        <mesh {...handlers}>
          <sphereGeometry args={[0.32, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {showName && (
        <Label position={[x, y + 0.42, z]}>
          <span
            className={`rounded px-1 text-[11px] ${emphasized ? "bg-background/95 font-semibold text-foreground shadow-sm" : "bg-background/75 font-medium text-muted-foreground"}`}
          >
            {shortDisciplineName(stat.discipline)}
          </span>
        </Label>
      )}
    </group>
  );
}

function ScatterScene({
  stats,
  highlighted,
  selected,
  onHover,
  onSelect,
  allowMotion,
  theme,
}: Omit<DisciplineAnalyticsSceneProps, "view" | "metric" | "dark" | "onCameraApi" | "className"> & { theme: Theme }) {
  const { half, height } = BOX;
  const xt = useMemo(() => niceTicks(Math.max(...stats.map((s) => s.articles), 0), 4), [stats]);
  const yt = useMemo(() => niceTicks(Math.max(...stats.map((s) => s.citations), 0), 4), [stats]);
  const zt = useMemo(() => niceTicks(Math.max(...stats.map((s) => s.views), 0), 4), [stats]);
  const sx = (v: number) => -half + (v / xt[xt.length - 1]) * half * 2;
  const sy = (v: number) => (v / yt[yt.length - 1]) * height;
  const sz = (v: number) => -half + (v / zt[zt.length - 1]) * half * 2;
  const focus = highlighted ?? selected;
  const named = useMemo(
    () => new Set([...stats].sort((a, b) => b.articles - a.articles).slice(0, 3).map((s) => s.discipline)),
    [stats]
  );

  const gridSegments = useMemo(() => {
    const segs: [number, number, number][] = [];
    const X = (v: number) => -half + (v / xt[xt.length - 1]) * half * 2;
    const Y = (v: number) => (v / yt[yt.length - 1]) * height;
    const Z = (v: number) => -half + (v / zt[zt.length - 1]) * half * 2;
    for (const t of xt) {
      segs.push([X(t), 0, -half], [X(t), height, -half]); // back wall
      segs.push([X(t), 0, -half], [X(t), 0, half]); // floor
    }
    for (const t of yt) {
      segs.push([-half, Y(t), -half], [half, Y(t), -half]); // back wall
      segs.push([-half, Y(t), -half], [-half, Y(t), half]); // left wall
    }
    for (const t of zt) {
      segs.push([-half, 0, Z(t)], [-half, height, Z(t)]); // left wall
      segs.push([-half, 0, Z(t)], [half, 0, Z(t)]); // floor
    }
    return segs;
  }, [xt, yt, zt, half, height]);

  return (
    <group>
      {/* Three translucent panes: back wall, left wall, floor. */}
      <mesh position={[0, height / 2, -half - 0.002]}>
        <planeGeometry args={[half * 2, height]} />
        <meshBasicMaterial color={theme.floor} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-half - 0.002, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[half * 2, height]} />
        <meshBasicMaterial color={theme.floor} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[half * 2, half * 2]} />
        <meshStandardMaterial color={theme.floor} roughness={0.9} transparent opacity={0.85} />
      </mesh>
      <GridLines segments={gridSegments} color={theme.grid} />

      {xt.map((t) => (
        <Label key={`x${t}`} position={[sx(t), 0, half + 0.38]}>
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatCompact(t)}</span>
        </Label>
      ))}
      {yt.map((t) => (
        <Label key={`y${t}`} position={[-half - 0.15, sy(t), half]} transform="translate(-100%, -50%)">
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatCompact(t)}</span>
        </Label>
      ))}
      {zt.map((t) => (
        <Label key={`z${t}`} position={[half + 0.5, 0, sz(t)]}>
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatCompact(t)}</span>
        </Label>
      ))}
      {[
        { text: "Published articles", position: [-half * 0.5, 0, half + 1.3] as [number, number, number] },
        { text: "Citations", position: [-half, height + 0.45, -half] as [number, number, number] },
        { text: "Views", position: [half + 1.45, 0, 0] as [number, number, number] },
      ].map((a) => (
        <Label key={a.text} position={a.position}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{a.text}</span>
        </Label>
      ))}

      {stats.map((s) => {
        const emphasized = focus === s.discipline;
        return (
          <Point
            key={s.discipline}
            stat={s}
            position={[sx(s.articles), sy(s.citations), sz(s.views)]}
            theme={theme}
            dim={!!focus && !emphasized}
            emphasized={emphasized}
            showName={emphasized || (!focus && named.has(s.discipline))}
            allowMotion={allowMotion}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}

      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={half * 2.6} blur={2.2} far={3.5} color={theme.shadow} />
    </group>
  );
}

// ─── Camera: fit-to-container framing, animated transitions, zoom API ───

const FRAMING: Record<AnalyticsView, { target: THREE.Vector3; dir: THREE.Vector3 }> = {
  bars: { target: new THREE.Vector3(-0.35, 1.2, 0), dir: new THREE.Vector3(0.14, 0.4, 1).normalize() },
  scatter: { target: new THREE.Vector3(0, 1.2, 0), dir: new THREE.Vector3(1, 0.72, 1.12).normalize() },
};

function CameraRig({
  view,
  barCount,
  allowMotion,
  onCameraApi,
}: {
  view: AnalyticsView;
  barCount: number;
  allowMotion: boolean;
  onCameraApi: (api: CameraApi | null) => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const fitted = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const { target, dir } = FRAMING[view];
    // Bars: frame the row's half-width plus axis/label margin horizontally,
    // and the tallest bar plus labels vertically. Scatter: frame the box's
    // bounding sphere plus its axis labels.
    const dist =
      view === "bars"
        ? Math.max((((barCount - 1) * BAR_SPACING) / 2 + 2.9) / Math.tan(hHalf), 2.9 / Math.tan(vHalf))
        : 4.3 / Math.sin(Math.min(vHalf, hHalf));
    return { position: target.clone().addScaledVector(dir, Math.max(dist, 6)), target: target.clone() };
  }, [view, barCount, size.width, size.height, camera.fov]);

  useEffect(() => {
    goal.current = { position: fitted.position.clone(), target: fitted.target.clone() };
    invalidate();
  }, [fitted, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      goal.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  useEffect(() => {
    onCameraApi({
      reset: () => {
        goal.current = { position: fitted.position.clone(), target: fitted.target.clone() };
        invalidate();
      },
      zoomBy: (factor) => {
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target);
        const len = THREE.MathUtils.clamp(offset.length() * factor, 4, 40);
        goal.current = {
          position: controls.target.clone().add(offset.setLength(len)),
          target: controls.target.clone(),
        };
        invalidate();
      },
    });
    return () => onCameraApi(null);
  }, [onCameraApi, fitted, controls, camera, invalidate]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = allowMotion ? 1 - Math.exp(-6 * dt) : 1;
    camera.position.lerp(g.position, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.005 && controls.target.distanceTo(g.target) < 0.005) {
      goal.current = null;
    } else {
      invalidate();
    }
  });

  return null;
}

export function DisciplineAnalyticsScene(props: DisciplineAnalyticsSceneProps) {
  const { view, dark, allowMotion, onCameraApi, className = "", onHover } = props;
  const theme: Theme = dark ? CHART_THEME.dark : CHART_THEME.light;

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <Canvas
        frameloop="demand"
        // No tone mapping: marks render in the exact palette-validated brand
        // colours instead of ACES's darker, desaturated remap.
        flat
        dpr={[1, 2]}
        camera={{ position: [2, 5, 14], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        onPointerMissed={() => onHover(null)}
      >
        <hemisphereLight args={[dark ? "#b9a6ff" : "#ffffff", dark ? "#0b0a12" : "#e9e3f7", dark ? 0.55 : 0.8]} />
        <directionalLight position={[6, 11, 7]} intensity={dark ? 1.1 : 1.35} />
        <directionalLight position={[-7, 4, -5]} intensity={0.35} color={dark ? "#9d78ed" : "#c9b8ff"} />
        {view === "bars" ? <BarsScene {...props} theme={theme} /> : <ScatterScene {...props} theme={theme} />}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          // Zoom lives on the toolbar buttons: wheel-zoom would trap page
          // scrolling whenever the pointer crosses the chart.
          enableZoom={false}
          rotateSpeed={0.7}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.06}
        />
        <CameraRig view={view} barCount={props.stats.length} allowMotion={allowMotion} onCameraApi={onCameraApi} />
      </Canvas>
    </div>
  );
}
