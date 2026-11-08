"use client";

/**
 * Auto-saved submission drafts. The submit wizard saves its fields (and
 * the already-uploaded manuscript's storage key) to this browser as the
 * author types, so a refresh, a closed tab or a lost connection never
 * loses the work; the dashboard offers to resume it.
 */

export interface SubmissionDraft {
  v: 1;
  savedAt: number;
  step: number;
  title: string;
  data: Record<string, unknown>;
}

const key = (userId: string) => `epip-submission-draft:${userId}`;
const MAX_AGE_MS = 60 * 24 * 3600 * 1000;

export function loadDraft(userId: string | undefined): SubmissionDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as SubmissionDraft;
    if (d?.v !== 1 || Date.now() - d.savedAt > MAX_AGE_MS) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string | undefined, draft: Omit<SubmissionDraft, "v" | "savedAt">): number | null {
  if (!userId) return null;
  try {
    const savedAt = Date.now();
    localStorage.setItem(key(userId), JSON.stringify({ v: 1, savedAt, ...draft }));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string | undefined) {
  if (!userId) return;
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* storage unavailable */
  }
}

export function savedAgo(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
