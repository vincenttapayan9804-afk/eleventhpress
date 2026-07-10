"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

/**
 * Discipline Visuals — 12 themed 3D realistic scenes, one per discipline.
 * Each scene is a lightweight animated 3D representation that reflects
 * the discipline's domain. Designed to render inside small card backgrounds.
 */

const ROYAL_PURPLE = "#6B2D8E";
const ROYAL_LIGHT = "#9D5BC4";
const ROYAL_DEEP = "#3D1A5C";
const PEARL = "#FAF7FE";

function MiniScene({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 3]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, -2, -2]} intensity={0.3} color={ROYAL_LIGHT} />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}

// ─── Physics: Atom with orbiting electrons ──────────────────────────────
function PhysicsScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.4; });
  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
      <group ref={group}>
        {/* Nucleus */}
        <mesh>
          <sphereGeometry args={[0.45, 32, 32]} />
          <meshStandardMaterial color={ROYAL_PURPLE} emissive={ROYAL_DEEP} emissiveIntensity={0.4} roughness={0.2} metalness={0.6} />
        </mesh>
        {/* Electron orbits — 3 rings at different angles */}
        {[0, Math.PI / 3, -Math.PI / 3].map((rot, i) => (
          <group key={i} rotation={[rot, 0, 0]}>
            <mesh>
              <torusGeometry args={[1.1, 0.015, 8, 64]} />
              <meshStandardMaterial color={ROYAL_LIGHT} transparent opacity={0.5} />
            </mesh>
            <ElectronOrbit radius={1.1} speed={2 + i * 0.5} offset={i * 2} />
          </group>
        ))}
      </group>
    </Float>
  );
}

function ElectronOrbit({ radius, speed, offset }: { radius: number; speed: number; offset: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.getElapsedTime() * speed + offset;
    ref.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={1.5} toneMapped={false} />
    </mesh>
  );
}

// ─── Biology: DNA double helix ──────────────────────────────────────────
function BiologyScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.5; });
  const helix = useMemo(() => {
    const rungs: { pos1: [number, number, number]; pos2: [number, number, number]; y: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const y = -1.6 + i * 0.25;
      const angle = i * 0.5;
      rungs.push({
        pos1: [Math.cos(angle) * 0.6, y, Math.sin(angle) * 0.6],
        pos2: [Math.cos(angle + Math.PI) * 0.6, y, Math.sin(angle + Math.PI) * 0.6],
        y,
      });
    }
    return rungs;
  }, []);
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {helix.map((r, i) => (
          <group key={i}>
            <mesh position={r.pos1}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color={ROYAL_PURPLE} emissive={ROYAL_DEEP} emissiveIntensity={0.3} />
            </mesh>
            <mesh position={r.pos2}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color={ROYAL_LIGHT} emissive={ROYAL_LIGHT} emissiveIntensity={0.3} />
            </mesh>
            {/* Rung connecting the two */}
            <mesh position={[0, r.y, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
              <meshStandardMaterial color="#B68FD4" transparent opacity={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </Float>
  );
}

// ─── Computer Science: Circuit chip ─────────────────────────────────────
function ComputerScienceScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.3; });
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {/* Central chip */}
        <mesh>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.3} metalness={0.8} emissive={ROYAL_PURPLE} emissiveIntensity={0.2} />
        </mesh>
        {/* Circuit traces */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const r = 0.9;
          return (
            <mesh key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[0.5, 0.04, 0.04]} />
              <meshStandardMaterial color={ROYAL_LIGHT} emissive={ROYAL_LIGHT} emissiveIntensity={0.8} toneMapped={false} />
            </mesh>
          );
        })}
        {/* Connection nodes */}
        {Array.from({ length: 4 }).map((_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const r = 1.2;
          return (
            <mesh key={`node-${i}`} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={1} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </Float>
  );
}

// ─── Sociology: Network of connected people ─────────────────────────────
function SociologyScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.25; });
  const nodes = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const theta = (i / 9) * Math.PI * 2;
      const phi = (i % 3) * 0.8;
      arr.push({
        pos: [1.3 * Math.cos(theta) * Math.cos(phi), Math.sin(phi) * 0.8, 1.3 * Math.sin(theta) * Math.cos(phi)],
        scale: 0.15 + (i % 3) * 0.05,
      });
    }
    return arr;
  }, []);
  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {/* Central node */}
        <mesh>
          <sphereGeometry args={[0.25, 24, 24]} />
          <meshStandardMaterial color={ROYAL_PURPLE} emissive={ROYAL_DEEP} emissiveIntensity={0.4} />
        </mesh>
        {/* Surrounding person-nodes */}
        {nodes.map((n, i) => (
          <group key={i}>
            <mesh position={n.pos} scale={n.scale}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color={ROYAL_LIGHT} emissive={ROYAL_LIGHT} emissiveIntensity={0.3} />
            </mesh>
            {/* Connection line */}
            <ConnectionLine3D start={[0, 0, 0]} end={n.pos} />
          </group>
        ))}
      </group>
    </Float>
  );
}

function ConnectionLine3D({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
    return g;
  }, [start, end]);
  return <line geometry={geo}><lineBasicMaterial color={ROYAL_LIGHT} transparent opacity={0.3} /></line>;
}

// ─── Economics: Stacked bar chart ───────────────────────────────────────
function EconomicsScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.2; });
  const bars = [
    { x: -0.9, h: 1.2, color: ROYAL_DEEP },
    { x: -0.3, h: 1.8, color: ROYAL_PURPLE },
    { x: 0.3, h: 1.4, color: ROYAL_LIGHT },
    { x: 0.9, h: 2.0, color: "#B68FD4" },
  ];
  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.2}>
      <group ref={group}>
        {/* Base platform */}
        <mesh position={[0, -0.9, 0]}>
          <boxGeometry args={[2.6, 0.08, 1.2]} />
          <meshStandardMaterial color="#2A1840" roughness={0.5} metalness={0.5} />
        </mesh>
        {bars.map((b, i) => (
          <mesh key={i} position={[b.x, b.h / 2 - 0.85, 0]}>
            <boxGeometry args={[0.4, b.h, 0.6]} />
            <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.15} roughness={0.2} metalness={0.6} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

// ─── Psychology: Brain network ──────────────────────────────────────────
function PsychologyScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.35; });
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {/* Brain lobes — two overlapping spheres */}
        <mesh position={[-0.3, 0, 0]} scale={[0.7, 0.85, 0.9]}>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshStandardMaterial color={ROYAL_PURPLE} roughness={0.3} metalness={0.4} emissive={ROYAL_DEEP} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0.3, 0, 0]} scale={[0.7, 0.85, 0.9]}>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.3} metalness={0.4} emissive={ROYAL_PURPLE} emissiveIntensity={0.15} />
        </mesh>
        {/* Neural connection sparks */}
        {Array.from({ length: 6 }).map((_, i) => {
          const t = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(t) * 0.9, Math.sin(t) * 0.5, Math.sin(t) * 0.6]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </Float>
  );
}

// ─── Environmental Science: Tree + globe ────────────────────────────────
function EnvironmentalScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.3; });
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {/* Trunk */}
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.12, 0.18, 0.8, 12]} />
          <meshStandardMaterial color="#3D2818" roughness={0.7} />
        </mesh>
        {/* Foliage — layered spheres */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.6, 24, 24]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.4} metalness={0.3} emissive={ROYAL_PURPLE} emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0.2, 0.6, 0.1]}>
          <sphereGeometry args={[0.4, 20, 20]} />
          <meshStandardMaterial color={ROYAL_PURPLE} roughness={0.4} metalness={0.3} emissive={ROYAL_DEEP} emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[-0.15, 0.5, -0.1]}>
          <sphereGeometry args={[0.35, 20, 20]} />
          <meshStandardMaterial color={ROYAL_LIGHT} roughness={0.4} metalness={0.3} emissive={ROYAL_PURPLE} emissiveIntensity={0.1} />
        </mesh>
        {/* Ground disc */}
        <mesh position={[0, -0.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial color="#1F1230" roughness={0.6} metalness={0.4} />
        </mesh>
      </group>
    </Float>
  );
}

// ─── Mathematics: Geometric polyhedra ───────────────────────────────────
function MathematicsScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.4; });
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.4}>
      <group ref={group}>
        {/* Icosahedron */}
        <mesh>
          <icosahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color={ROYAL_PURPLE} roughness={0.15} metalness={0.7} emissive={ROYAL_DEEP} emissiveIntensity={0.2} flatShading />
        </mesh>
        {/* Wireframe overlay */}
        <mesh scale={1.02}>
          <icosahedronGeometry args={[0.9, 0]} />
          <meshBasicMaterial color={ROYAL_LIGHT} wireframe transparent opacity={0.4} />
        </mesh>
        {/* Small orbiting cube */}
        <mesh position={[1.3, 0.3, 0]} scale={0.2}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

// ─── Education: Graduation cap + book ───────────────────────────────────
function EducationScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.3; });
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {/* Book base */}
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[1.3, 0.15, 0.9]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.4} metalness={0.5} />
        </mesh>
        {/* Book pages */}
        <mesh position={[0, -0.38, 0]}>
          <boxGeometry args={[1.2, 0.06, 0.82]} />
          <meshStandardMaterial color={PEARL} roughness={0.6} />
        </mesh>
        {/* Graduation cap mortarboard */}
        <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[1.0, 0.06, 1.0]} />
          <meshStandardMaterial color={ROYAL_PURPLE} roughness={0.3} metalness={0.6} emissive={ROYAL_DEEP} emissiveIntensity={0.15} />
        </mesh>
        {/* Cap base */}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.3, 0.35, 0.25, 16]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.3} metalness={0.6} />
        </mesh>
        {/* Tassel */}
        <mesh position={[0.4, 0.45, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <mesh position={[0.4, 0.3, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.3, 6]} />
          <meshStandardMaterial color="#FFE9B0" />
        </mesh>
      </group>
    </Float>
  );
}

// ─── Business: Corporate building + chart ───────────────────────────────
function BusinessScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.25; });
  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.2}>
      <group ref={group}>
        {/* Main tower */}
        <mesh position={[-0.3, 0, 0]}>
          <boxGeometry args={[0.6, 2, 0.6]} />
          <meshPhysicalMaterial color={ROYAL_DEEP} roughness={0.1} metalness={0.5} transmission={0.3} transparent opacity={0.85} emissive={ROYAL_PURPLE} emissiveIntensity={0.1} />
        </mesh>
        {/* Side tower */}
        <mesh position={[0.5, -0.3, 0.2]}>
          <boxGeometry args={[0.4, 1.4, 0.4]} />
          <meshPhysicalMaterial color={ROYAL_PURPLE} roughness={0.1} metalness={0.5} transmission={0.3} transparent opacity={0.85} emissive={ROYAL_DEEP} emissiveIntensity={0.1} />
        </mesh>
        {/* Lit windows on main tower */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[-0.3, -0.8 + i * 0.3, 0.301]}>
            <planeGeometry args={[0.1, 0.1]} />
            <meshStandardMaterial color={Math.random() > 0.4 ? "#FFE9B0" : "#1A1430"} emissive={Math.random() > 0.4 ? "#FFB84D" : "#000"} emissiveIntensity={Math.random() > 0.4 ? 0.7 : 0} />
          </mesh>
        ))}
        {/* Rising arrow (growth) */}
        <mesh position={[0.2, 0.8, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <coneGeometry args={[0.12, 0.3, 4]} />
          <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

// ─── Technology: Rotating gear ──────────────────────────────────────────
function TechnologyScene() {
  const gear1 = useRef<THREE.Group>(null);
  const gear2 = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (gear1.current) gear1.current.rotation.z = s.clock.getElapsedTime() * 0.5;
    if (gear2.current) gear2.current.rotation.z = -s.clock.getElapsedTime() * 0.5;
  });

  const gearGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const teeth = 12;
    const innerR = 0.5;
    const outerR = 0.7;
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
  }, []);

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group rotation={[0.5, 0, 0]}>
        <group ref={gear1}>
          <primitive object={gearGeometry} />
          <meshStandardMaterial color={ROYAL_PURPLE} roughness={0.3} metalness={0.7} emissive={ROYAL_DEEP} emissiveIntensity={0.15} />
        </group>
        <group ref={gear2} position={[0.95, 0.95, 0]} scale={0.65}>
          <primitive object={gearGeometry.clone()} />
          <meshStandardMaterial color={ROYAL_LIGHT} roughness={0.3} metalness={0.7} emissive={ROYAL_PURPLE} emissiveIntensity={0.15} />
        </group>
        {/* Central light */}
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#FFE9B0" emissive="#FFB84D" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

// ─── Language and Literature: Open book with quill ──────────────────────
function LanguageScene() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => { if (group.current) group.current.rotation.y = s.clock.getElapsedTime() * 0.25; });
  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={group}>
        {/* Open book — two pages */}
        <mesh position={[-0.35, 0, 0]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.7, 0.05, 0.9]} />
          <meshStandardMaterial color={PEARL} roughness={0.5} />
        </mesh>
        <mesh position={[0.35, 0, 0]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.7, 0.05, 0.9]} />
          <meshStandardMaterial color={PEARL} roughness={0.5} />
        </mesh>
        {/* Spine */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[0.04, 0.1, 0.9]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.4} metalness={0.4} />
        </mesh>
        {/* Text lines on left page */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`l-${i}`} position={[-0.35, 0.04, -0.3 + i * 0.15]}>
            <boxGeometry args={[0.5, 0.005, 0.04]} />
            <meshStandardMaterial color={ROYAL_LIGHT} transparent opacity={0.4} />
          </mesh>
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`r-${i}`} position={[0.35, 0.04, -0.3 + i * 0.15]}>
            <boxGeometry args={[0.5, 0.005, 0.04]} />
            <meshStandardMaterial color={ROYAL_LIGHT} transparent opacity={0.4} />
          </mesh>
        ))}
        {/* Quill pen */}
        <mesh position={[0.5, 0.5, 0.3]} rotation={[0.5, 0.3, 0.8]}>
          <cylinderGeometry args={[0.015, 0.03, 1, 8]} />
          <meshStandardMaterial color={ROYAL_PURPLE} emissive={ROYAL_DEEP} emissiveIntensity={0.2} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Ink dot */}
        <mesh position={[0.2, 0.04, 0.4]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={ROYAL_DEEP} roughness={0.2} metalness={0.3} />
        </mesh>
      </group>
    </Float>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────────
const SCENES: Record<string, () => JSX.Element> = {
  Physics: PhysicsScene,
  Biology: BiologyScene,
  "Computer Science": ComputerScienceScene,
  Sociology: SociologyScene,
  Economics: EconomicsScene,
  Psychology: PsychologyScene,
  "Environmental Science": EnvironmentalScene,
  Mathematics: MathematicsScene,
  Education: EducationScene,
  Business: BusinessScene,
  Technology: TechnologyScene,
  "Language and Literature": LanguageScene,
};

export function DisciplineVisual({ discipline, className = "" }: { discipline: string; className?: string }) {
  const SceneComp = SCENES[discipline] || PhysicsScene;
  return (
    <div className={`webgl-container ${className}`}>
      <MiniScene>
        <SceneComp />
      </MiniScene>
    </div>
  );
}
