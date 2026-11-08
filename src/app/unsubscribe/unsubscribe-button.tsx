"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ token, what }: { token: string; what: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") {
    return <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm">Done — you won&rsquo;t receive {what} any more.</p>;
  }
  return (
    <div className="mt-6">
      <Button
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await fetch(`/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
          setState(res?.ok ? "done" : "error");
        }}
      >
        {state === "busy" ? "Saving…" : "Unsubscribe"}
      </Button>
      {state === "error" && <p className="mt-3 text-sm text-destructive">That didn&rsquo;t work. Please try again.</p>}
    </div>
  );
}
