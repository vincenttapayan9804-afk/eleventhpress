"use client";

import { useState } from "react";
import { BellPlus, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";

/** Creates a weekly reading alert (src/lib/reading-alerts.ts) for a search, discipline or author. */
export function AlertMeButton({
  kind,
  query,
  label = "Alert me",
  className,
  size = "sm",
}: {
  kind: "SEARCH" | "DISCIPLINE" | "AUTHOR" | "MAGAZINE";
  query: string;
  label?: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const user = useApp((s) => s.user);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const create = async () => {
    if (!user) {
      toast.message("Sign in to get alerts for new publications");
      useApp.getState().setView("login");
      return;
    }
    setState("busy");
    try {
      await apiFetch("/api/alerts", { method: "POST", body: JSON.stringify({ kind, query, frequency: "WEEKLY" }) });
      setState("done");
      toast.success("Alert created — you'll hear about new publications weekly", {
        action: { label: "Manage", onClick: () => useApp.getState().openDashboard("library") },
      });
    } catch (e: any) {
      setState("idle");
      toast.error(e.message);
    }
  };
  return (
    <Button variant="outline" size={size} className={className} onClick={create} disabled={state !== "idle"}>
      {state === "busy" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : state === "done" ? <BellRing className="mr-1.5 h-3.5 w-3.5 text-primary" /> : <BellPlus className="mr-1.5 h-3.5 w-3.5" />}
      {state === "done" ? "Alert on" : label}
    </Button>
  );
}
