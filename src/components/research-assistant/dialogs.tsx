"use client";

import { useState } from "react";
import { Check, ClipboardCopy, FolderOpen, Link2, Link2Off, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { copyText } from "./actions";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function modKey(): string {
  return isMac() ? "⌘" : "Ctrl";
}

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["/"], label: "Focus the question box" },
  { keys: ["Enter"], label: "Send the question" },
  { keys: ["Shift", "Enter"], label: "New line in the question" },
  { keys: ["Esc"], label: "Stop the answer being prepared (while it's running)" },
  { keys: ["Alt", "N"], label: "New conversation" },
  { keys: ["Alt", "E"], label: "Show or hide the evidence panel" },
  { keys: ["Alt", "S"], label: "Change the search scope" },
  { keys: ["Alt", "↑"], label: "Edit your last question" },
  { keys: ["↑", "↓"], label: "Move between sources in the evidence panel" },
  { keys: ["?"], label: "Show these shortcuts" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-xs font-semibold text-foreground shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work through the Research Assistant without a mouse. Citation numbers and sources are reachable with Tab.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border/70">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-sm text-foreground">{s.label}</dt>
              <dd className="flex flex-shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

/** File a saved response in a collection, start a new one, or take it out of its collection. */
export function CollectionDialog({
  open,
  onOpenChange,
  current,
  folders,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: string | null;
  folders: string[];
  onSubmit: (folder: string | null) => Promise<void>;
}) {
  // The parent remounts this dialog (key) for each response, so this starts from its current collection.
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const submit = async (folder: string | null) => {
    setBusy(true);
    try {
      await onSubmit(folder);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add to a collection</DialogTitle>
          <DialogDescription>Group saved responses, for example by chapter or topic, and export a collection as one literature notebook.</DialogDescription>
        </DialogHeader>
        {folders.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Your collections">
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setValue(f)}
                aria-pressed={value === f}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  value === f ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                )}
              >
                <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" /> {f}
              </button>
            ))}
          </div>
        )}
        <label className="block text-sm font-medium text-foreground">
          {folders.length ? "Or a new collection" : "Collection name"}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) void submit(value.trim());
            }}
            maxLength={60}
            placeholder="e.g. Chapter 2 — literature review"
            className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal focus:border-primary focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          {current ? (
            <button type="button" onClick={() => void submit(null)} disabled={busy} className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Remove from “{current}”
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !value.trim()}
              onClick={() => void submit(value.trim())}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save to collection
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A conversation's read-only link: copy it, or revoke it. */
export function ShareDialog({
  open,
  onOpenChange,
  url,
  creating,
  onRevoke,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  url: string | null;
  creating: boolean;
  onRevoke: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Share a read-only link</DialogTitle>
          <DialogDescription>
            Anyone with the link can read this conversation — the questions, answers, citations and sources — as it stands now and as you add to it. Your name isn&apos;t shown. Signed-in readers can copy it to continue it themselves.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm">
            <Link2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            {creating || !url ? (
              <span className="text-muted-foreground">Creating link…</span>
            ) : (
              <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent outline-none" />
            )}
          </div>
          <button
            type="button"
            disabled={!url}
            onClick={async () => {
              if (url && (await copyText(url))) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }
            }}
            className="inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          disabled={!url || revoking}
          onClick={async () => {
            setRevoking(true);
            try {
              await onRevoke();
              onOpenChange(false);
            } finally {
              setRevoking(false);
            }
          }}
          className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />} Stop sharing (the link stops working)
        </button>
      </DialogContent>
    </Dialog>
  );
}
