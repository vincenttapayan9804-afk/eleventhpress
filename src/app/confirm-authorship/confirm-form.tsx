"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmAuthorshipForm({ token, name, initialStatus }: { token: string; name: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [disputing, setDisputing] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/authorship/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, confirm, comment: confirm ? undefined : comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus(data.status);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (status === "CONFIRMED") {
    return (
      <p className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" /> Thank you, {name.split(" ")[0]} — your authorship is confirmed.
      </p>
    );
  }
  if (status === "DISPUTED") {
    return (
      <p className="mt-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" /> Thanks for letting us know. The editors and the corresponding author have been told.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm">
        Are you, <strong>{name}</strong>, an author of this manuscript, with your contribution described correctly above?
      </p>
      {disputing ? (
        <div className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="What isn't right? For example: I'm not an author, my name or affiliation is wrong, or my contribution is described incorrectly."
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDisputing(false)} disabled={busy}>Back</Button>
            <Button variant="destructive" onClick={() => send(false)} disabled={busy || !comment.trim()}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Report the problem
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send(true)} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Yes, I confirm
          </Button>
          <Button variant="outline" onClick={() => setDisputing(true)} disabled={busy}>Something isn&rsquo;t right</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
