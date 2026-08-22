"use client";

import { Badge } from "@/components/ui/badge";
import { Pin, PinOff, Trash2, Tag, Link2 } from "lucide-react";

export interface SecondBrainNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shared note card used by the Atrium view (and reused, in a compact form,
 * by Constellation/Tide's detail panels). Kept separate from
 * second-brain-tab.tsx so the three views can all import it without a
 * circular dependency back into the tab.
 */
export function NoteCard({
  note,
  linkCount,
  onTogglePin,
  onDelete,
  accentColor,
}: {
  note: SecondBrainNote;
  linkCount: number;
  onTogglePin: (n: SecondBrainNote) => void;
  onDelete: (id: string) => void;
  accentColor?: string;
}) {
  return (
    <div
      className="rounded-lg border border-border p-4 transition-colors hover:border-primary/30"
      style={{ borderLeftWidth: "3px", borderLeftColor: note.color || accentColor || "transparent" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold leading-snug">{note.title}</h3>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => onTogglePin(note)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={note.pinned ? "Unpin" : "Pin"}
          >
            {note.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-3 text-xs text-foreground/80">{note.content}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {note.tags.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 text-[0.6rem]">
            <Tag className="h-2.5 w-2.5" /> {t}
          </Badge>
        ))}
        {linkCount > 0 && (
          <Badge variant="secondary" className="ml-auto gap-1 text-[0.6rem]">
            <Link2 className="h-2.5 w-2.5" /> {linkCount} link{linkCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
    </div>
  );
}
