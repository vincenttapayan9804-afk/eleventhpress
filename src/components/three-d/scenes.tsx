"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, Sphere, MeshDistortMaterial, Environment, ContactShadows, GradientTexture } from "@react-three/drei";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

/**
 * EPIP 3D Ecosystem — Enterprise-grade corporate architecture.
 *
 * The hero scene is a production-grade 3D corporate campus: multiple modern
 * glass-and-steel towers with royal-purple tinted facades, a reflective
 * ground plane, volumetric fog, and a slow cinematic camera drift.
 *
 * All scenes use a shared Canvas with consistent lighting and the royal-
 * purple material palette. Components are low-poly + instanced for fluidity.
 */

const ROYAL_PURPLE = "#6B2D8E";
const ROYAL_LIGHT = "#9D5BC4";
const ROYAL_DEEP = "#3D1A5C";
const PEARL = "#FAF7FE";
const GLASS_BLUE = "#4A5F8A";

// ─── Shared Scene Wrapper ───────────────────────────────────────────────
function SceneWrapper({
  children,
  cameraPosition = [0, 0, 5],
  fog,
}: {
  children: React.ReactNode;
  cameraPosition?: [number, number, number];
  fog?: [string, number, number];
}) {
  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      {...(fog ? { scene: { fog: new THREE.Fog(fog[0], fog[1], fog[2]) } } : {})}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 12, 6]} intensity={1.0} color="#ffffff" castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={0.3} color={ROYAL_LIGHT} />
      <pointLight position={[0, 2, 8]} intensity={0.4} color={ROYAL_PURPLE} />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1. CORPORATE CAMPUS — enterprise-grade multi-structure building scene
// ═══════════════════════════════════════════════════════════════════════

interface BuildingDef {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  rotation?: number;
  tint: string;
  glassOpacity: number;
  hasAntenna?: boolean;
  windowDensity?: number;
}

const CAMPUS_BUILDINGS: BuildingDef[] = [
  // Central tower — the flagship
  { position: [0, 0, 0], width: 1.6, depth: 1.6, height: 7.5, tint: ROYAL_DEEP, glassOpacity: 0.72, hasAntenna: true, windowDensity: 8 },
  // Left tower — slightly shorter, angled
  { position: [-3.2, 0, 0.8], width: 1.3, depth: 1.3, height: 5.8, rotation: -0.15, tint: ROYAL_PURPLE, glassOpacity: 0.68, windowDensity: 7 },
  // Right tower — mid-height
  { position: [3.0, 0, -0.4], width: 1.4, depth: 1.4, height: 6.4, rotation: 0.12, tint: "#5A2A7A", glassOpacity: 0.70, windowDensity: 7 },
  // Far left — low-rise
  { position: [-5.8, 0, 1.6], width: 1.1, depth: 1.6, height: 3.2, tint: "#4D2670", glassOpacity: 0.65, windowDensity: 5 },
  // Far right — low-rise
  { position: [5.6, 0, 1.0], width: 1.2, depth: 1.3, height: 3.8, tint: "#542873", glassOpacity: 0.66, windowDensity: 5 },
  // Background center-left
  { position: [-1.8, 0, -3.5], width: 1.0, depth: 1.0, height: 4.5, tint: "#3F2160", glassOpacity: 0.60, windowDensity: 6 },
  // Background center-right
  { position: [2.2, 0, -3.8], width: 1.1, depth: 1.1, height: 5.2, tint: "#462468", glassOpacity: 0.62, windowDensity: 6 },
  // Deep background left
  { position: [-4.5, 0, -4.2], width: 0.9, depth: 0.9, height: 3.8, tint: "#381E58", glassOpacity: 0.55, windowDensity: 4 },
  // Deep background right
  { position: [4.8, 0, -4.5], width: 0.9, depth: 0.9, height: 4.2, tint: "#3A1F5C", glassOpacity: 0.55, windowDensity: 4 },
];

function Building({ def }: { def: BuildingDef }) {
  const groupRef = useRef<THREE.Group>(null);
  const { position, width, depth, height, rotation = 0, tint, glassOpacity, hasAntenna, windowDensity = 6 } = def;

  // Generate window grid as instanced meshes for performance
  const windows = useMemo(() => {
    const cols = Math.max(3, Math.floor(width * windowDensity));
    const rows = Math.max(6, Math.floor(height * windowDensity));
    const arr: { pos: [number, number, number]; lit: boolean; size: [number, number] }[] = [];
    const colSpacing = (width - 0.15) / cols;
    const rowSpacing = (height - 0.2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() > 0.55;
        arr.push({
          pos: [
            -width / 2 + 0.075 + colSpacing * c + colSpacing / 2,
            0.15 + rowSpacing * r + rowSpacing / 2,
            depth / 2 + 0.001,
          ],
          lit,
          size: [colSpacing * 0.6, rowSpacing * 0.55],
        });
      }
    }
    return arr;
  }, [width, depth, height, windowDensity]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {/* Building core — glass facade */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhysicalMaterial
          color={tint}
          roughness={0.05}
          metalness={0.3}
          transmission={0.4}
          transparent
          opacity={glassOpacity}
          ior={1.5}
          thickness={0.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
          emissive={ROYAL_DEEP}
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* Window grid — front face */}
      {windows.map((w, i) => (
        <mesh key={`wf-${i}`} position={w.pos}>
          <planeGeometry args={w.size} />
          <meshStandardMaterial
            color={w.lit ? "#FFE9B0" : "#1A1430"}
            emissive={w.lit ? "#FFB84D" : "#000000"}
            emissiveIntensity={w.lit ? 0.6 : 0}
            roughness={0.2}
            metalness={0.4}
          />
        </mesh>
      ))}

      {/* Window grid — back face */}
      {windows.map((w, i) => (
        <mesh key={`wb-${i}`} position={[w.pos[0], w.pos[1], -depth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={w.size} />
          <meshStandardMaterial
            color={w.lit ? "#FFE9B0" : "#1A1430"}
            emissive={w.lit ? "#FFB84D" : "#000000"}
            emissiveIntensity={w.lit ? 0.4 : 0}
            roughness={0.2}
            metalness={0.4}
          />
        </mesh>
      ))}

      {/* Window grid — left face */}
      {windows.filter((_, i) => i % 2 === 0).map((w, i) => (
        <mesh key={`wl-${i}`} position={[-width / 2 - 0.001, w.pos[1], w.pos[2] - depth / 2 + depth / 2]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[depth * 0.8, w.size[1]]} />
          <meshStandardMaterial
            color={w.lit ? "#FFE9B0" : "#1A1430"}
            emissive={w.lit ? "#FFB84D" : "#000000"}
            emissiveIntensity={w.lit ? 0.5 : 0}
            roughness={0.2}
            metalness={0.4}
          />
        </mesh>
      ))}

      {/* Rooftop cap */}
      <mesh position={[0, height + 0.08, 0]}>
        <boxGeometry args={[width * 0.95, 0.16, depth * 0.95]} />
        <meshStandardMaterial color="#2A1840" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Rooftop mechanical unit */}
      <mesh position={[0, height + 0.25, 0]}>
        <boxGeometry args={[width * 0.4, 0.25, depth * 0.4]} />
        <meshStandardMaterial color="#1F1230" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Antenna for flagship tower */}
      {hasAntenna && (
        <>
          <mesh position={[0, height + 1.2, 0]}>
            <cylinderGeometry args={[0.02, 0.04, 2, 8]} />
            <meshStandardMaterial color="#9D5BC4" roughness={0.3} metalness={0.8} emissive={ROYAL_LIGHT} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, height + 2.2, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#FF4D6D" emissive="#FF4D6D" emissiveIntensity={1.5} />
          </mesh>
        </>
      )}

      {/* Ground floor entrance glow */}
      <mesh position={[0, 0.3, depth / 2 + 0.01]}>
        <planeGeometry args={[width * 0.5, 0.6]} />
        <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={0.8} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function GroundPlane() {
  return (
    <>
      {/* Reflective ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color="#0F0A1A"
          roughness={0.15}
          metalness={0.9}
          envMapIntensity={0.5}
        />
      </mesh>
      {/* Subtle grid overlay */}
      <gridHelper args={[60, 60, ROYAL_PURPLE, "#1A1230"]} position={[0, 0.01, 0]} />
    </>
  );
}

function CampusScene() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Slow cinematic orbit
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.05) * 0.15;
    groupRef.current.position.y = Math.sin(t * 0.3) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {CAMPUS_BUILDINGS.map((b, i) => (
        <Building key={i} def={b} />
      ))}
      {/* Central plaza light */}
      <pointLight position={[0, 0.5, 2]} intensity={0.6} color={ROYAL_LIGHT} distance={8} />
      {/* Ambient purple glow between buildings */}
      <pointLight position={[-2, 3, 1]} intensity={0.3} color={ROYAL_PURPLE} distance={6} />
      <pointLight position={[2, 3, -1]} intensity={0.3} color={ROYAL_PURPLE} distance={6} />
    </group>
  );
}

function CinematicCamera() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Gentle figure-8 camera drift
    const x = Math.sin(t * 0.08) * 2;
    const y = 4 + Math.sin(t * 0.12) * 0.5;
    const z = 12 + Math.cos(t * 0.06) * 1.5;
    state.camera.position.lerp(new THREE.Vector3(x, y, z), 0.02);
    state.camera.lookAt(0, 2.5, 0);
  });
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// 1b. GIANT PURPLE GLOBE — full-size hero centerpiece
// ═══════════════════════════════════════════════════════════════════════

/**
 * Orbital ring particles — small purple motes orbiting the globe.
 */
function OrbitalRing({ radius, count, speed, color, tilt = 0 }: { radius: number; count: number; speed: number; color: string; tilt?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      arr[i * 3] = Math.cos(theta) * radius;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      arr[i * 3 + 2] = Math.sin(theta) * radius;
    }
    return arr;
  }, [radius, count]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.getElapsedTime() * speed;
      ref.current.rotation.x = tilt;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={color}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Latitude/longitude wireframe lines on the globe surface — gives the
 * sphere a "global" cartographic feel.
 */
function GlobeWireframe({ radius }: { radius: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.getElapsedTime() * 0.04;
    }
  });

  const lines = useMemo(() => {
    const arr: JSX.Element[] = [];
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (lat * Math.PI) / 180;
      const r = radius * Math.cos(phi);
      const y = radius * Math.sin(phi);
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      arr.push(
        <line key={`lat-${lat}`} geometry={geo}>
          <lineBasicMaterial color={ROYAL_LIGHT} transparent opacity={lat === 0 ? 0.35 : 0.15} />
        </line>
      );
    }
    // Longitude lines
    for (let lon = 0; lon < 360; lon += 30) {
      const theta = (lon * Math.PI) / 180;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const phi = (i / 64) * Math.PI - Math.PI / 2;
        const r = radius * Math.cos(phi);
        const y = radius * Math.sin(phi);
        points.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      arr.push(
        <line key={`lon-${lon}`} geometry={geo}>
          <lineBasicMaterial color={ROYAL_LIGHT} transparent opacity={0.12} />
        </line>
      );
    }
    return arr;
  }, [radius]);

  return <group ref={ref}>{lines}</group>;
}

/**
 * Floating research node markers on the globe surface — represent
 * global research presence (universities, institutions).
 */
function ResearchMarkers({ radius }: { radius: number }) {
  const markers = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; color: string }[] = [];
    const locations = [
      { lat: 51, lon: 0 },    // London
      { lat: 40, lon: -74 },  // New York
      { lat: 35, lon: 139 },  // Tokyo
      { lat: 1, lon: 103 },   // Singapore
      { lat: -33, lon: 151 }, // Sydney
      { lat: 55, lon: 37 },   // Moscow
      { lat: -23, lon: -46 }, // São Paulo
      { lat: 28, lon: 77 },   // Delhi
      { lat: 30, lon: 31 },   // Cairo
      { lat: -26, lon: 28 },  // Johannesburg
      { lat: 59, lon: 18 },   // Stockholm
      { lat: 49, lon: 2 },    // Paris
    ];
    const colors = [ROYAL_LIGHT, "#B68FD4", "#9D5BC4", "#C9A5E8"];
    locations.forEach((loc, i) => {
      const phi = (loc.lat * Math.PI) / 180;
      const theta = (loc.lon * Math.PI) / 180;
      const r = radius * 1.01;
      arr.push({
        pos: [r * Math.cos(phi) * Math.cos(theta), r * Math.sin(phi), r * Math.cos(phi) * Math.sin(theta)],
        scale: 0.04 + (i % 3) * 0.015,
        color: colors[i % colors.length],
      });
    });
    return arr;
  }, [radius]);

  return (
    <group>
      {markers.map((m, i) => (
        <ResearchMarker key={i} position={m.pos} scale={m.scale} color={m.color} delay={i * 0.5} />
      ))}
    </group>
  );
}

function ResearchMarker({ position, scale, color, delay }: { position: [number, number, number]; scale: number; color: string; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime() + delay;
      ref.current.scale.setScalar(scale * (1 + Math.sin(t * 2) * 0.3));
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} toneMapped={false} />
    </mesh>
  );
}

/**
 * The giant purple globe — central distorted sphere with layered atmosphere.
 */
function GiantGlobe() {
  const groupRef = useRef<THREE.Group>(null);
  const GLOBE_RADIUS = 2.8;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Core globe — distorted purple sphere */}
      <Sphere args={[GLOBE_RADIUS, 128, 128]}>
        <MeshDistortMaterial
          color={ROYAL_PURPLE}
          distort={0.18}
          speed={1.5}
          roughness={0.15}
          metalness={0.6}
          emissive={ROYAL_DEEP}
          emissiveIntensity={0.25}
          clearcoat={0.8}
          clearcoatRoughness={0.2}
        />
      </Sphere>

      {/* Inner glow shell */}
      <Sphere args={[GLOBE_RADIUS * 1.04, 64, 64]}>
        <meshBasicMaterial
          color={ROYAL_LIGHT}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>

      {/* Wireframe cartographic overlay */}
      <GlobeWireframe radius={GLOBE_RADIUS * 1.001} />

      {/* Research location markers */}
      <ResearchMarkers radius={GLOBE_RADIUS} />

      {/* Orbital particle rings */}
      <OrbitalRing radius={GLOBE_RADIUS * 1.5} count={80} speed={0.15} color={ROYAL_LIGHT} tilt={0.1} />
      <OrbitalRing radius={GLOBE_RADIUS * 1.8} count={60} speed={-0.1} color="#B68FD4" tilt={-0.25} />
      <OrbitalRing radius={GLOBE_RADIUS * 2.1} count={40} speed={0.08} color={ROYAL_PURPLE} tilt={0.4} />
    </group>
  );
}

/**
 * Atmospheric halo — a large soft glow behind the globe.
 */
function GlobeHalo() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.getElapsedTime() * 0.02;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0, -1]} scale={12}>
      <circleGeometry args={[1, 64]} />
      <meshBasicMaterial
        color={ROYAL_PURPLE}
        transparent
        opacity={0.06}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function GlobeCamera() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Slow gentle drift around the globe
    const x = Math.sin(t * 0.06) * 1.5;
    const y = 0.5 + Math.sin(t * 0.1) * 0.3;
    const z = 7.5 + Math.cos(t * 0.05) * 0.8;
    state.camera.position.lerp(new THREE.Vector3(x, y, z), 0.02);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function PurpleGlobe({ className = "" }: { className?: string }) {
  return (
    <div className={`webgl-container ${className}`}>
      <SceneWrapper cameraPosition={[0, 0.5, 7.5]}>
        <GlobeCamera />
        <GlobeHalo />
        <GiantGlobe />
        <Stars radius={100} depth={40} count={1200} factor={4} fade speed={0.4} />
        <Environment preset="sunset" />
      </SceneWrapper>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CITATION NETWORK — orbital nodes around a central building
// ═══════════════════════════════════════════════════════════════════════

function CitationNode({ position, color, size }: { position: [number, number, number]; color: string; size: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.scale.setScalar(size * (1 + Math.sin(state.clock.getElapsedTime() * 2) * 0.1));
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} emissive={color} emissiveIntensity={0.2} />
    </mesh>
  );
}

export function CitationNetwork({ citations = 0, className = "" }: { citations?: number; className?: string }) {
  const nodes = useMemo(() => {
    const total = Math.min(30, Math.max(6, Math.floor(citations / 5) + 6));
    return Array.from({ length: total }, (_, i) => {
      const theta = (i / total) * Math.PI * 2;
      const r = 1.5 + (i % 3) * 0.4;
      return {
        position: [r * Math.cos(theta), Math.sin(i) * 0.8, r * Math.sin(theta)] as [number, number, number],
        color: i % 3 === 0 ? ROYAL_PURPLE : i % 3 === 1 ? ROYAL_LIGHT : "#B68FD4",
        size: 0.15 + (i % 4) * 0.05,
      };
    });
  }, [citations]);

  return (
    <div className={`webgl-container ${className}`}>
      <SceneWrapper cameraPosition={[0, 1, 5]}>
        <group>
          {nodes.map((n, i) => (
            <CitationNode key={i} position={n.position} color={n.color} size={n.size} />
          ))}
          {/* Central mini-tower */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 1.2, 0.5]} />
            <meshPhysicalMaterial color={ROYAL_DEEP} roughness={0.1} metalness={0.9} emissive={ROYAL_PURPLE} emissiveIntensity={0.3} transparent opacity={0.85} />
          </mesh>
        </group>
        <ContactShadows position={[0, -1, 0]} opacity={0.3} scale={10} blur={2.5} color={ROYAL_DEEP} />
      </SceneWrapper>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 3. KEYWORD CLUSTER — floating orbs (kept for browse page)
// ═══════════════════════════════════════════════════════════════════════

export function KeywordCluster({ keywords = [], className = "", allowMotion = true }: { keywords?: string[]; className?: string; allowMotion?: boolean }) {
  const orbs = useMemo(() => {
    const colors = [ROYAL_PURPLE, ROYAL_LIGHT, ROYAL_DEEP, "#B68FD4", "#9D5BC4"];
    return keywords.slice(0, 8).map((kw, i) => {
      const theta = (i / Math.max(keywords.length, 1)) * Math.PI * 2;
      const phi = (i / Math.max(keywords.length, 1)) * Math.PI;
      const r = 2 + (i % 3) * 0.3;
      return {
        position: [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.6, r * Math.sin(phi) * Math.sin(theta)] as [number, number, number],
        label: kw,
        color: colors[i % colors.length],
        scale: 0.6 + (kw.length % 4) * 0.1,
      };
    });
  }, [keywords]);

  const spheres = (
    <group>
      {orbs.map((o, i) => (
        <mesh key={i} position={o.position} scale={o.scale}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <meshStandardMaterial color={o.color} roughness={0.2} metalness={0.7} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );

  return (
    <div className={`webgl-container ${className}`}>
      <SceneWrapper cameraPosition={[0, 0, 6]}>
        {/* Unlike the purely ambient/decorative scenes (HeroGlobe,
            ImpactSphere), this one is only ever mounted after the user
            explicitly clicks "3D Cluster" — skipping it entirely under
            prefers-reduced-motion would remove the content they asked
            for, not just motion. Only the floating/rotating animation
            itself is gated; the orbs still render statically. */}
        {allowMotion ? (
          <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.5}>
            {spheres}
          </Float>
        ) : (
          spheres
        )}
      </SceneWrapper>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 4. CORPORATE SPIRE — compact accent for stat cards and CTAs
// ═══════════════════════════════════════════════════════════════════════

export function CorporateSpire({ className = "" }: { className?: string }) {
  return (
    <div className={`webgl-container ${className}`}>
      <SceneWrapper cameraPosition={[0, 1.5, 4]}>
        <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
          <group>
            {/* Mini skyscraper */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.6, 2.2, 0.6]} />
              <meshPhysicalMaterial
                color={ROYAL_DEEP}
                roughness={0.08}
                metalness={0.4}
                transmission={0.35}
                transparent
                opacity={0.78}
                ior={1.5}
                clearcoat={1}
                clearcoatRoughness={0.1}
                emissive={ROYAL_PURPLE}
                emissiveIntensity={0.08}
              />
            </mesh>
            {/* Lit windows */}
            {Array.from({ length: 8 }).map((_, i) => (
              <mesh key={i} position={[0, -0.9 + i * 0.28, 0.301]}>
                <planeGeometry args={[0.12, 0.12]} />
                <meshStandardMaterial
                  color={Math.random() > 0.4 ? "#FFE9B0" : "#1A1430"}
                  emissive={Math.random() > 0.4 ? "#FFB84D" : "#000000"}
                  emissiveIntensity={Math.random() > 0.4 ? 0.7 : 0}
                />
              </mesh>
            ))}
            {/* Antenna */}
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.015, 0.03, 0.6, 6]} />
              <meshStandardMaterial color={ROYAL_LIGHT} metalness={0.8} roughness={0.2} emissive={ROYAL_LIGHT} emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0, 1.75, 0]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#FF4D6D" emissive="#FF4D6D" emissiveIntensity={1.5} />
            </mesh>
          </group>
        </Float>
        <ContactShadows position={[0, -1.2, 0]} opacity={0.4} scale={4} blur={2} color={ROYAL_DEEP} />
      </SceneWrapper>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 5. AMBIENT FLOATERS — kept for dashboard accents
// ═══════════════════════════════════════════════════════════════════════

export function AmbientFloaters({ className = "" }: { className?: string }) {
  return (
    <div className={`webgl-container ${className}`}>
      <SceneWrapper cameraPosition={[0, 0, 4]}>
        <Float speed={1.5} rotationIntensity={1} floatIntensity={1}>
          <mesh>
            <torusKnotGeometry args={[1, 0.3, 100, 16]} />
            <meshStandardMaterial color={ROYAL_PURPLE} roughness={0.15} metalness={0.8} emissive={ROYAL_DEEP} emissiveIntensity={0.1} />
          </mesh>
        </Float>
        <Stars radius={20} depth={10} count={300} factor={1.5} fade speed={0.5} />
      </SceneWrapper>
    </div>
  );
}

// Legacy export for backward compatibility — now renders the corporate spire
export function ImpactSphere({ className = "" }: { className?: string }) {
  return <CorporateSpire className={className} />;
}

// Hero export — renders the giant purple globe
export function HeroGlobe({ className = "" }: { className?: string }) {
  return <PurpleGlobe className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════
// 6. METRICS BAR CHART — arbitrary-magnitude 3D bars for the article
//    Metrics tab (citation count, page views, PDF downloads). Heights use
//    a sqrt scale (not linear) so one very large count doesn't flatten the
//    other bars to invisibility while still preserving relative ordering.
// ═══════════════════════════════════════════════════════════════════════

interface MetricBarDatum {
  label: string;
  value: number;
  color: string;
}

function MetricBar3D({ x, height, color, delay }: { x: number; height: number; color: string; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      const bob = Math.sin(state.clock.getElapsedTime() * 1.1 + delay) * 0.02;
      ref.current.position.y = height / 2 - 1 + bob;
    }
  });
  return (
    <mesh ref={ref} position={[x, height / 2 - 1, 0]}>
      <boxGeometry args={[0.62, height, 0.62]} />
      <meshStandardMaterial color={color} roughness={0.25} metalness={0.55} emissive={color} emissiveIntensity={0.18} />
    </mesh>
  );
}

/** Three (or more) magnitude bars on a shared shadow-catching ground plane,
 * slow individual bob so the scene reads as alive without being distracting. */
export function MetricsBarChart3D({ items, className = "" }: { items: MetricBarDatum[]; className?: string }) {
  const heights = useMemo(() => {
    const magnitudes = items.map((it) => Math.sqrt(Math.max(it.value, 0)));
    const max = Math.max(...magnitudes, 1);
    return magnitudes.map((m) => 0.35 + (m / max) * 2.1);
  }, [items]);

  const spacing = 1.35;
  const startX = -((items.length - 1) * spacing) / 2;

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="webgl-container min-h-0 flex-1">
        <SceneWrapper cameraPosition={[2.7, 1.7, 4.3]}>
          <group>
            {items.map((it, i) => (
              <MetricBar3D key={it.label} x={startX + i * spacing} height={heights[i]} color={it.color} delay={i} />
            ))}
          </group>
          <ContactShadows position={[0, -1.005, 0]} opacity={0.35} scale={7} blur={2.4} color={ROYAL_DEEP} />
        </SceneWrapper>
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

// ═══════════════════════════════════════════════════════════════════════
// 7. FILL GAUGES — percentage-metric "liquid fill" tubes for the article
//    Metrics tab (in-corpus similarity, iThenticate similarity). A null
//    value (not yet checked) renders as an empty, dim tube rather than a
//    fabricated fill level.
// ═══════════════════════════════════════════════════════════════════════

interface MetricGaugeDatum {
  label: string;
  value: number | null;
  color: string;
}

function FillGauge3D({ x, value, color }: { x: number; value: number | null; color: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0)) / 100;
  const tubeHeight = 1.7;
  const fillHeight = Math.max(tubeHeight * pct, 0.001);
  return (
    <group position={[x, -0.85, 0]}>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.46, 32]} />
        <meshStandardMaterial color={ROYAL_DEEP} roughness={0.5} metalness={0.3} />
      </mesh>
      {value != null && (
        <mesh position={[0, fillHeight / 2, 0]}>
          <cylinderGeometry args={[0.42, 0.42, fillHeight, 32]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.5} emissive={color} emissiveIntensity={0.22} />
        </mesh>
      )}
      <mesh position={[0, tubeHeight / 2, 0]}>
        <cylinderGeometry args={[0.46, 0.46, tubeHeight, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={value != null ? 0.14 : 0.07}
          roughness={0.05}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Two (or more) percentage tubes side by side, sharing one ground shadow. */
export function MetricsFillGauge3D({ items, className = "" }: { items: MetricGaugeDatum[]; className?: string }) {
  const spacing = 1.7;
  const startX = -((items.length - 1) * spacing) / 2;

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="webgl-container min-h-0 flex-1">
        <SceneWrapper cameraPosition={[0, 0.3, 4.6]}>
          <group>
            {items.map((it, i) => (
              <FillGauge3D key={it.label} x={startX + i * spacing} value={it.value} color={it.color} />
            ))}
          </group>
          <ContactShadows position={[0, -0.86, 0]} opacity={0.3} scale={6} blur={2.2} color={ROYAL_DEEP} />
        </SceneWrapper>
      </div>
      <div className="flex shrink-0 justify-center gap-0.5 px-1 pt-1">
        {items.map((it) => (
          <p key={it.label} className="flex-1 px-0.5 text-center text-[0.58rem] font-medium leading-[1.15]" style={{ color: it.value != null ? it.color : ROYAL_DEEP }} title={it.label}>
            {it.label}
          </p>
        ))}
      </div>
    </div>
  );
}
