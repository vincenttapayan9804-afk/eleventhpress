"use client";

import { NoteCard, type SecondBrainNote } from "./note-card";

/**
 * Atrium — the calm, structured reading-room view. Pinned notes sit in
 * their own "alcove" up top, everything else follows in a steady grid.
 * This is the plain-functional layout Phase 1 shipped, now one of three
 * selectable presentations over the same data.
 */
export function AtriumView({
  notes,
  linkCountByNote,
  onTogglePin,
  onDelete,
  accentColor,
}: {
  notes: SecondBrainNote[];
  linkCountByNote: Record<string, number>;
  onTogglePin: (n: SecondBrainNote) => void;
  onDelete: (id: string) => void;
  accentColor?: string;
}) {
  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-border py-12 text-center text-xs text-muted-foreground">
        Nothing captured yet — your first note starts the graph.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {pinned.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">Pinned</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinned.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                linkCount={linkCountByNote[n.id] || 0}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
                accentColor={accentColor}
              />
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {pinned.length > 0 && <p className="eyebrow">All notes</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              linkCount={linkCountByNote[n.id] || 0}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              accentColor={accentColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
