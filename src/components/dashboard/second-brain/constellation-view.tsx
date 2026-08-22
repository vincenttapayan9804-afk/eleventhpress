"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pin, PinOff, Trash2, Tag, X } from "lucide-react";
import type { SecondBrainNote } from "./note-card";
import type { SecondBrainLink } from "@/lib/second-brain";

const SIZE = 520;
const CENTER = SIZE / 2;
const GLOBE_RADIUS = 62;
// Orbits are ellipses (rx > ry) rather than circles so the ring of notes
// reads as wrapping around the globe in perspective, not floating flat.
const ORBIT_RX = [110, 165, 222];
const ORBIT_RY_RATIO = 0.42;
const MAX_LABEL_CHARS = 22;

interface PlacedNode {
  note: SecondBrainNote;
  ring: number;
  x: number;
  y: number;
  radius: number;
  linkCount: number;
  labelAnchor: "start" | "end";
}

function layoutOrbits(notes: SecondBrainNote[], linkCountByNote: Record<string, number>): PlacedNode[] {
  if (notes.length === 0) return [];
  // Most-connected notes gravitate to the inner orbit — that's the "core"
  // of the graph — everything else fans out to the outer shells.
  const sorted = [...notes].sort((a, b) => (linkCountByNote[b.id] || 0) - (linkCountByNote[a.id] || 0));
  const total = sorted.length;
  const capacities = [Math.max(1, Math.ceil(total * 0.15)), Math.ceil(total * 0.35), Infinity];

  const placed: PlacedNode[] = [];
  let ring = 0;
  let indexInRing = 0;
  let ringCount = Math.min(total, capacities[0]);

  for (let i = 0; i < sorted.length; i++) {
    if (indexInRing >= ringCount && ring < ORBIT_RX.length - 1) {
      ring++;
      indexInRing = 0;
      const remaining = total - i;
      ringCount = ring === ORBIT_RX.length - 1 ? remaining : Math.min(remaining, capacities[ring]);
    }
    const note = sorted[i];
    const angle = (indexInRing / Math.max(1, ringCount)) * Math.PI * 2 + ring * 0.4;
    const rx = ORBIT_RX[ring];
    const ry = rx * ORBIT_RY_RATIO;
    const linkCount = linkCountByNote[note.id] || 0;
    const x = CENTER + rx * Math.cos(angle);
    placed.push({
      note,
      ring,
      x,
      y: CENTER + ry * Math.sin(angle),
      radius: (note.pinned ? 9 : 6) + Math.min(linkCount, 6) * 1.1,
      linkCount,
      labelAnchor: x >= CENTER ? "start" : "end",
    });
    indexInRing++;
  }
  return placed;
}

function truncateTitle(title: string): string {
  return title.length > MAX_LABEL_CHARS ? `${title.slice(0, MAX_LABEL_CHARS)}…` : title;
}

/**
 * Constellation — a glass globe at the core with each note orbiting it as a
 * labeled star, most-connected notes riding the inner orbit. Purely a
 * re-presentation of the same notes/links Atrium shows; nothing here is
 * persisted separately.
 */
export function ConstellationView({
  notes,
  links,
  linkCountByNote,
  onTogglePin,
  onDelete,
  accentColor = "#8b7cf6",
}: {
  notes: SecondBrainNote[];
  links: SecondBrainLink[];
  linkCountByNote: Record<string, number>;
  onTogglePin: (n: SecondBrainNote) => void;
  onDelete: (id: string) => void;
  accentColor?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const placed = useMemo(() => layoutOrbits(notes, linkCountByNote), [notes, linkCountByNote]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.note.id, p])), [placed]);
  const selected = selectedId ? notes.find((n) => n.id === selectedId) || null : null;

  const rings = useMemo(() => {
    const groups: PlacedNode[][] = [[], [], []];
    for (const p of placed) groups[p.ring].push(p);
    return groups;
  }, [placed]);

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-border py-12 text-center text-xs text-muted-foreground">
        Your constellation is empty — capture a note to place its first star.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-[radial-gradient(circle_at_center,rgba(139,124,246,0.08),transparent_70%)]">
        <style>{`
          @keyframes sb-orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes sb-globe-spin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
          .sb-orbit-ring { transform-origin: ${CENTER}px ${CENTER}px; animation: sb-orbit-spin linear infinite; }
          .sb-globe-graticule { transform-origin: ${CENTER}px ${CENTER}px; animation: sb-globe-spin linear infinite; animation-duration: 140s; }
          @media (prefers-reduced-motion: reduce) { .sb-orbit-ring, .sb-globe-graticule { animation: none; } }
        `}</style>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-xl" role="img" aria-label="Constellation view: notes orbiting a glass globe">
          <defs>
            <clipPath id="sbGlobeClip">
              <circle cx={CENTER} cy={CENTER} r={GLOBE_RADIUS} />
            </clipPath>
            <radialGradient id="sbGlobeFill" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
              <stop offset="40%" stopColor={accentColor} stopOpacity={0.32} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0.1} />
            </radialGradient>
            <radialGradient id="sbGlobeHighlight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </radialGradient>
            <filter id="sbSoftBlur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="sbGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          </defs>

          {/* Ambient glow behind the globe */}
          <circle cx={CENTER} cy={CENTER} r={GLOBE_RADIUS + 14} fill={accentColor} fillOpacity={0.16} filter="url(#sbGlow)" />

          {/* Glass sphere body */}
          <circle cx={CENTER} cy={CENTER} r={GLOBE_RADIUS} fill="url(#sbGlobeFill)" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1.25} />

          {/* Graticule — latitude/longitude lines wrapping the sphere, gently spinning */}
          <g className="sb-globe-graticule" clipPath="url(#sbGlobeClip)" opacity={0.5}>
            {[-0.62, -0.3, 0, 0.3, 0.62].map((t) => (
              <ellipse
                key={`lat-${t}`}
                cx={CENTER}
                cy={CENTER + t * GLOBE_RADIUS}
                rx={GLOBE_RADIUS * Math.sqrt(Math.max(0.05, 1 - t * t))}
                ry={GLOBE_RADIUS * 0.16}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.35}
                strokeWidth={0.75}
              />
            ))}
            {[0, 30, 60, 90, 120, 150].map((deg) => (
              <ellipse
                key={`lon-${deg}`}
                cx={CENTER}
                cy={CENTER}
                rx={GLOBE_RADIUS * 0.42}
                ry={GLOBE_RADIUS}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.28}
                strokeWidth={0.75}
                transform={`rotate(${deg} ${CENTER} ${CENTER})`}
              />
            ))}
          </g>

          {/* Specular highlight — the "liquid glass" sheen */}
          <ellipse cx={CENTER - 22} cy={CENTER - 26} rx={26} ry={16} fill="url(#sbGlobeHighlight)" filter="url(#sbSoftBlur)" />
          <circle cx={CENTER} cy={CENTER} r={GLOBE_RADIUS} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={4} />

          {/* Faint orbit guides */}
          {ORBIT_RX.map((rx) => (
            <ellipse key={rx} cx={CENTER} cy={CENTER} rx={rx} ry={rx * ORBIT_RY_RATIO} fill="none" stroke="currentColor" strokeOpacity={0.08} className="text-foreground" />
          ))}

          {links.map((l) => {
            const a = byId.get(l.a);
            const b = byId.get(l.b);
            if (!a || !b) return null;
            const strength = Math.min(l.sharedTags.length, 4);
            return (
              <line
                key={`${l.a}-${l.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={accentColor}
                strokeOpacity={0.12 + strength * 0.1}
                strokeWidth={1 + strength * 0.3}
              />
            );
          })}

          {rings.map((group, ringIndex) => (
            <g key={ringIndex} className="sb-orbit-ring" style={{ animationDuration: `${70 + ringIndex * 40}s`, animationDirection: ringIndex % 2 === 0 ? "normal" : "reverse" }}>
              {group.map((p) => (
                <g key={p.note.id} onClick={() => setSelectedId(p.note.id)} className="cursor-pointer">
                  <title>{p.note.title}</title>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.radius}
                    fill={p.note.color || accentColor}
                    fillOpacity={selectedId === p.note.id ? 1 : 0.85}
                    stroke={selectedId === p.note.id ? "currentColor" : "none"}
                    strokeWidth={2}
                    className="text-foreground transition-all"
                  />
                  {p.note.pinned && (
                    <circle cx={p.x} cy={p.y} r={p.radius + 4} fill="none" stroke={accentColor} strokeOpacity={0.5} strokeWidth={1} />
                  )}
                  <text
                    x={p.x + (p.labelAnchor === "start" ? p.radius + 5 : -(p.radius + 5))}
                    y={p.y + 3}
                    textAnchor={p.labelAnchor}
                    className="fill-foreground/80"
                    style={{ fontSize: 9, fontWeight: p.note.pinned ? 600 : 400 }}
                  >
                    {truncateTitle(p.note.title)}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="rounded-xl border border-border p-4">
        {!selected ? (
          <p className="text-xs text-muted-foreground">
            Each star is labeled with its note's title. Brighter, larger stars have more connections; lines mark shared tags. Tap a star to read it.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-sm font-semibold leading-snug">{selected.title}</h3>
              <button onClick={() => setSelectedId(null)} className="rounded p-1 text-muted-foreground hover:bg-accent" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="max-h-48 overflow-y-auto text-xs text-foreground/80">{selected.content}</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.tags.map((t) => (
                <Badge key={t} variant="outline" className="gap-1 text-[0.6rem]">
                  <Tag className="h-2.5 w-2.5" /> {t}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onTogglePin(selected)}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {selected.pinned ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
                {selected.pinned ? "Pinned" : "Pin"}
              </button>
              <button
                onClick={() => {
                  onDelete(selected.id);
                  setSelectedId(null);
                }}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
