"use client";

/**
 * Second Brain — the WebGL half of the 3D knowledge graph. Lazy-loaded
 * (ssr:false) by graph-3d-panel.tsx, which owns all DOM chrome: toolbar,
 * tooltip, details panel and the SVG fallback for devices without WebGL.
 * Layout comes precomputed from src/lib/second-brain-graph.ts.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Html, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { sceneDpr } from "@/components/three-d/discipline-analytics-shared";
import { LabelDeclutter, declutterProps } from "@/components/three-d/label-declutter";
import { tideWaveY, type GraphLayout, type GraphNode, type Vec3 } from "@/lib/second-brain-graph";

export type GraphMode = "constellation" | "tide";

export interface GraphCameraApi {
  zoomBy: (factor: number) => void;
  reset: () => void;
}

export interface SecondBrainGraphSceneProps {
  mode: GraphMode;
  layout: GraphLayout;
  accent: string;
  dark: boolean;
  allowMotion: boolean;
  autoRotate: boolean;
  /** Note under the pointer (or keyboard focus in the panel). */
  hovered: string | null;
  selected: string | null;
  /** Notes to keep lit (selection + neighbours, or a tag filter). null = all lit. */
  lit: Set<string> | null;
  onHover: (id: string | null, pointer?: { x: number; y: number }) => void;
  onSelect: (id: string | null) => void;
  onCameraApi: (api: GraphCameraApi | null) => void;
}

const LABEL_Z: [number, number] = [20, 0];
const MAX_LABELS = 14;
/** Date ticks sit on one baseline just below the wave's lowest point. */
const TIDE_TICK_Y = -2.15;

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Faint starfield shell — fixed seed so it never shimmers between renders. */
function Starfield({ color, count = 420, radius = 26 }: { color: string; count?: number; radius?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = seeded(i) * 2 - 1;
      const th = seeded(i + 1000) * Math.PI * 2;
      const r = radius * (0.7 + seeded(i + 2000) * 0.3);
      const s = Math.sqrt(1 - u * u);
      arr[i * 3] = Math.cos(th) * s * r;
      arr[i * 3 + 1] = u * r;
      arr[i * 3 + 2] = Math.sin(th) * s * r;
    }
    return arr;
  }, [count, radius]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/** Glass core of the constellation: translucent sphere, wire lattice, inner glow. */
function GlassCore({ accent, allowMotion }: { accent: string; allowMotion: boolean }) {
  const lattice = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (allowMotion && lattice.current) lattice.current.rotation.y += dt * 0.08;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.25, 48, 48]} />
        <meshPhysicalMaterial
          color={accent}
          transparent
          opacity={0.22}
          roughness={0.08}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={lattice}>
        <icosahedronGeometry args={[1.27, 2]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Faint orbit rings marking the three constellation shells. */
function ShellRings({ color }: { color: string }) {
  const rings = useMemo(
    () =>
      [2.4, 3.8, 5.2].map((r) => {
        const pts: Vec3[] = [];
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          pts.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
        }
        return pts;
      }),
    []
  );
  return (
    <group rotation={[0.18, 0, 0.06]}>
      {rings.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={1} transparent opacity={0.22} />
      ))}
    </group>
  );
}

/** Translucent wave ribbon the tide's notes float above. */
function TideRibbon({ accent, extent }: { accent: string; extent: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(extent * 2 + 1, 5, 120, 12);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, tideWaveY(x) + Math.sin(z * 1.4 + x * 0.3) * 0.06);
    }
    g.computeVertexNormals();
    return g;
  }, [extent]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={accent}
          transparent
          opacity={0.3}
          roughness={0.15}
          clearcoat={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

function NodeMesh({
  node,
  color,
  state,
  allowMotion,
  onHover,
  onSelect,
  mode,
}: {
  node: GraphNode;
  color: string;
  state: "normal" | "dim" | "hot";
  allowMotion: boolean;
  onHover: SecondBrainGraphSceneProps["onHover"];
  onSelect: SecondBrainGraphSceneProps["onSelect"];
  mode: GraphMode;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const bob = useRef<THREE.Group>(null);
  const phase = useMemo(() => seeded(node.id.length * 31 + node.position[0] * 7) * Math.PI * 2, [node]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const target = state === "hot" ? 1.45 : 1;
    const s = THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.18);
    mesh.current.scale.setScalar(s);
    if (allowMotion && mode === "tide" && bob.current) {
      bob.current.position.y = Math.sin(clock.elapsedTime * 0.9 + phase) * 0.06;
    }
  });
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
      onHover(node.id, { x: e.clientX, y: e.clientY });
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(node.id, { x: e.clientX, y: e.clientY });
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
      onHover(null);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta > 4) return; // the end of an orbit drag, not a click
      onSelect(node.id);
    },
  };
  const dim = state === "dim";
  return (
    <group position={node.position}>
      {mode === "tide" && (
        // Stem down to the wave surface.
        <Line
          points={[
            [0, 0, 0],
            [0, tideWaveY(node.position[0]) - node.position[1], 0],
          ]}
          color={color}
          lineWidth={1}
          transparent
          opacity={dim ? 0.12 : 0.45}
        />
      )}
      <group ref={bob}>
      <mesh ref={mesh} {...handlers}>
        <sphereGeometry args={[node.radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={state === "hot" ? 0.9 : dim ? 0.05 : 0.38}
          roughness={0.25}
          metalness={0.35}
          transparent
          opacity={dim ? 0.22 : 1}
        />
      </mesh>
      {/* Soft halo */}
      <mesh scale={state === "hot" ? 2.6 : 2}>
        <sphereGeometry args={[node.radius, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={dim ? 0.02 : state === "hot" ? 0.22 : 0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {node.pinned && (
        <Billboard>
          <mesh>
            <ringGeometry args={[node.radius * 1.55, node.radius * 1.75, 48]} />
            <meshBasicMaterial color={color} transparent opacity={dim ? 0.15 : 0.85} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      )}
      </group>
    </group>
  );
}

function SizeReporter({ onWidth }: { onWidth: (w: number) => void }) {
  const width = useThree((s) => s.size.width);
  useEffect(() => onWidth(width), [width, onWidth]);
  return null;
}

function CameraRig({
  mode,
  extent,
  focus,
  onCameraApi,
}: {
  mode: GraphMode;
  extent: number;
  focus: Vec3 | null;
  onCameraApi: (api: GraphCameraApi | null) => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const getState = useThree((s) => s.get);
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // Vertical swipes scroll the page on touch screens; horizontal swipes orbit.
  useEffect(() => {
    if (controls) getState().gl.domElement.style.touchAction = "pan-y";
  }, [controls, getState]);

  const home = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const dist = (extent + 0.4) / Math.sin(Math.min(vHalf, hHalf));
    const dir = mode === "constellation" ? new THREE.Vector3(0.35, 0.4, 1).normalize() : new THREE.Vector3(0, 0.42, 1).normalize();
    const target = new THREE.Vector3(0, mode === "tide" ? -0.3 : 0, 0);
    // Tide is a wide strip: fit its full width to the horizontal field of view.
    const tideDist = Math.max((extent + 1.3) / Math.tan(hHalf), 7);
    return { position: target.clone().addScaledVector(dir, mode === "tide" ? tideDist : dist * 0.8), target };
  }, [mode, extent, size.width, size.height, camera.fov]);

  useEffect(() => {
    goal.current = { position: home.position.clone(), target: home.target.clone() };
    invalidate();
  }, [home, invalidate]);

  // Glide toward a selected note, keeping the current viewing direction.
  useEffect(() => {
    if (!focus || !controls) return;
    const target = new THREE.Vector3(...focus);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.max(4.5, home.position.distanceTo(home.target) * 0.55);
    goal.current = { position: target.clone().addScaledVector(dir, dist), target };
    invalidate();
  }, [focus, controls, camera, home, invalidate]);

  useEffect(() => {
    onCameraApi({
      zoomBy: (factor) => {
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
        const len = THREE.MathUtils.clamp(offset.length(), 2.5, 60);
        goal.current = { position: controls.target.clone().add(offset.setLength(len)), target: controls.target.clone() };
        invalidate();
      },
      reset: () => {
        goal.current = { position: home.position.clone(), target: home.target.clone() };
        invalidate();
      },
    });
    return () => onCameraApi(null);
  }, [controls, camera, home, invalidate, onCameraApi]);

  useFrame(() => {
    const g = goal.current;
    if (!g || !controls) return;
    camera.position.lerp(g.position, 0.12);
    controls.target.lerp(g.target, 0.12);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.01 && controls.target.distanceTo(g.target) < 0.01) goal.current = null;
    else invalidate();
  });
  return null;
}

/** Keeps date ticks ~90px apart on screen (always the first and last). */
function thinTicks<T>(ticks: T[], width: number): T[] {
  const max = Math.max(2, Math.floor(width / 90));
  if (ticks.length <= max) return ticks;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(ticks[Math.round((i * (ticks.length - 1)) / (max - 1))]);
  return [...new Set(out)];
}

export function SecondBrainGraphScene(props: SecondBrainGraphSceneProps) {
  const { mode, layout, accent, dark, allowMotion, autoRotate, hovered, selected, lit, onHover, onSelect, onCameraApi } = props;
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const hot = hovered ?? selected;
  const [canvasWidth, setCanvasWidth] = useState(800);

  const { dimEdges, litEdges } = useMemo(() => {
    const dimSegs: Vec3[] = [];
    const litByStrength: Vec3[][] = [[], [], [], [], []];
    for (const e of layout.edges) {
      const a = byId.get(e.a);
      const b = byId.get(e.b);
      if (!a || !b) continue;
      const active = hot ? e.a === hot || e.b === hot : lit ? lit.has(e.a) && lit.has(e.b) : true;
      if (active) litByStrength[e.strength].push(a.position, b.position);
      else dimSegs.push(a.position, b.position);
    }
    return { dimEdges: dimSegs, litEdges: litByStrength };
  }, [layout, byId, hot, lit]);

  const labelled = useMemo(() => {
    const pick: GraphNode[] = [];
    const add = (n: GraphNode | undefined) => n && !pick.includes(n) && pick.push(n);
    if (hot) add(byId.get(hot));
    // Tide packs notes along one strip, so neighbour labels would collide:
    // it names only the note under focus.
    if (mode === "tide") return pick;
    if (hot) for (const e of layout.edges) if (e.a === hot || e.b === hot) add(byId.get(e.a === hot ? e.b : e.a));
    if (!hot) {
      // At rest, label only pinned notes and the top hubs so names don't pile up.
      for (const n of layout.nodes) if (n.pinned && pick.length < 3) add(n);
      for (const n of [...layout.nodes].sort((a, b) => b.linkCount - a.linkCount)) if (pick.length < 4) add(n);
    }
    return pick.slice(0, MAX_LABELS);
  }, [hot, byId, layout, mode]);

  const focus = selected ? byId.get(selected)?.position ?? null : null;
  const edgeColor = dark ? "#c9b8ff" : accent;
  const ink = dark ? "#e9e3f7" : "#2a2140";

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  return (
    <Canvas
      frameloop={allowMotion ? "always" : "demand"}
      dpr={sceneDpr()}
      camera={{ position: [0, 4, 16], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      onPointerMissed={() => {
        onHover(null);
        onSelect(null);
      }}
    >
      <hemisphereLight args={[dark ? "#b9a6ff" : "#ffffff", dark ? "#0b0a12" : "#e9e3f7", dark ? 0.6 : 0.9]} />
      <directionalLight position={[6, 10, 8]} intensity={dark ? 1.1 : 1.3} />
      <pointLight position={[0, 0, 0]} intensity={mode === "constellation" ? 8 : 0} distance={9} color={accent} />
      <directionalLight position={[-8, 3, -6]} intensity={0.4} color={dark ? "#9d78ed" : "#c9b8ff"} />

      <Starfield color={dark ? "#cfc3ff" : "#8b7cf6"} />
      {mode === "constellation" ? (
        <>
          <GlassCore accent={accent} allowMotion={allowMotion} />
          <ShellRings color={edgeColor} />
        </>
      ) : (
        <>
          <TideRibbon accent={accent} extent={layout.extent - 1} />
          {thinTicks(layout.ticks, canvasWidth).map((t) => (
            <Html key={`${t.x}-${t.label}`} position={[t.x, TIDE_TICK_Y, 2.7]} center zIndexRange={LABEL_Z} style={{ pointerEvents: "none" }}>
              <span
                className="whitespace-nowrap rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
                {...declutterProps(1)}
              >
                {t.label}
              </span>
            </Html>
          ))}
        </>
      )}

      {dimEdges.length > 0 && <Line points={dimEdges} segments color={edgeColor} lineWidth={1} transparent opacity={0.08} />}
      {litEdges.map((segs, strength) =>
        segs.length > 0 ? (
          <Line
            key={strength}
            points={segs}
            segments
            color={edgeColor}
            lineWidth={hot ? 1.2 + strength * 0.6 : 0.8 + strength * 0.35}
            transparent
            opacity={hot ? 0.95 : 0.22 + strength * 0.1}
          />
        ) : null
      )}

      {layout.nodes.map((n) => {
        const isHot = n.id === hot;
        const dim = !isHot && lit !== null && !lit.has(n.id);
        return (
          <NodeMesh
            key={n.id}
            node={n}
            color={n.color || accent}
            state={isHot ? "hot" : dim ? "dim" : "normal"}
            allowMotion={allowMotion}
            onHover={onHover}
            onSelect={onSelect}
            mode={mode}
          />
        );
      })}

      {labelled.map((n) => (
        <Html
          key={`label-${n.id}`}
          position={[n.position[0], n.position[1] + n.radius + 0.22, n.position[2]]}
          center
          zIndexRange={LABEL_Z}
          style={{ pointerEvents: "none" }}
        >
          <span
            className="block max-w-[11rem] truncate whitespace-nowrap rounded-md border border-border/70 bg-background/90 px-1.5 py-0.5 text-[10.5px] shadow-sm backdrop-blur-sm"
            style={{ color: ink, fontWeight: n.id === hot || n.pinned ? 600 : 500 }}
            {...declutterProps(n.id === hot ? 5 : n.pinned ? 3 : 2)}
          >
            {n.title}
          </span>
        </Html>
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.7}
        autoRotate={allowMotion && autoRotate && !hot}
        autoRotateSpeed={0.45}
        minPolarAngle={0.2}
        maxPolarAngle={mode === "tide" ? Math.PI / 2 - 0.05 : Math.PI - 0.2}
      />
      <LabelDeclutter />
      <CameraRig mode={mode} extent={layout.extent} focus={focus} onCameraApi={onCameraApi} />
      <SizeReporter onWidth={setCanvasWidth} />
    </Canvas>
  );
}
