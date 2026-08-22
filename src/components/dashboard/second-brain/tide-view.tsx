"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pin, PinOff, Trash2, Tag, X } from "lucide-react";
import type { SecondBrainNote } from "./note-card";

const WIDTH = 900;
const ROW_HEIGHT = 130;
const WAVE_AMPLITUDE = 26;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Tide — notes flow in chronological order along a gentle wave, grouped
 * by the day they were captured. A timeline re-presentation of the same
 * data Atrium/Constellation show.
 */
export function TideView({
  notes,
  linkCountByNote,
  onTogglePin,
  onDelete,
  accentColor = "#8b7cf6",
}: {
  notes: SecondBrainNote[];
  linkCountByNote: Record<string, number>;
  onTogglePin: (n: SecondBrainNote) => void;
  onDelete: (id: string) => void;
  accentColor?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const chronological = useMemo(
    () => [...notes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [notes]
  );

  const days = useMemo(() => {
    const groups: { day: string; notes: SecondBrainNote[] }[] = [];
    for (const note of chronological) {
      const day = formatDay(note.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.notes.push(note);
      } else {
        groups.push({ day, notes: [note] });
      }
    }
    return groups;
  }, [chronological]);

  const selected = selectedId ? notes.find((n) => n.id === selectedId) || null : null;

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-border py-12 text-center text-xs text-muted-foreground">
        The tide is still — capture a note to set it moving.
      </div>
    );
  }

  const rowCount = days.length;
  const height = Math.max(180, rowCount * ROW_HEIGHT + 40);
  const wavePath = Array.from({ length: rowCount }, (_, i) => {
    const y = 40 + i * ROW_HEIGHT;
    const cy = y + (i % 2 === 0 ? WAVE_AMPLITUDE : -WAVE_AMPLITUDE);
    return i === 0 ? `M 20 ${y}` : `Q ${WIDTH / 2} ${cy} ${WIDTH - 20} ${y}`;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="overflow-x-auto rounded-xl border border-primary/15 bg-[linear-gradient(180deg,rgba(139,124,246,0.05),transparent_40%)] p-2">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full min-w-[480px]" role="img" aria-label="Tide view of your notes over time">
          <path d={wavePath.join(" ")} fill="none" stroke={accentColor} strokeOpacity={0.25} strokeWidth={2} />
          {days.map((group, i) => {
            const y = 40 + i * ROW_HEIGHT;
            return (
              <g key={group.day}>
                <text x={20} y={y - 18} className="fill-muted-foreground text-[11px]" style={{ fontSize: 11 }}>
                  {group.day}
                </text>
                {group.notes.map((note, j) => {
                  const spacing = Math.min(160, (WIDTH - 80) / Math.max(1, group.notes.length));
                  const x = 40 + j * spacing;
                  const linkCount = linkCountByNote[note.id] || 0;
                  const r = (note.pinned ? 8 : 6) + Math.min(linkCount, 4) * 0.8;
                  return (
                    <g key={note.id} onClick={() => setSelectedId(note.id)} className="cursor-pointer">
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill={note.color || accentColor}
                        fillOpacity={selectedId === note.id ? 1 : 0.85}
                        stroke={selectedId === note.id ? "currentColor" : "none"}
                        strokeWidth={2}
                        className="text-foreground transition-all"
                      />
                      <text x={x} y={y + r + 14} textAnchor="middle" className="fill-foreground/70" style={{ fontSize: 9 }}>
                        {note.title.length > 16 ? `${note.title.slice(0, 16)}…` : note.title}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="rounded-xl border border-border p-4">
        {!selected ? (
          <p className="text-xs text-muted-foreground">
            Notes flow left to right in the order you captured them, grouped by day. Tap a buoy to read it.
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
