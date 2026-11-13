"use client";

/**
 * Download button for an article's research visuals (infographic, poster,
 * graphical abstract, framework). The first download of an article runs
 * its analysis, which can take a little while, so this fetches the PDF
 * with a visible "Preparing…" state instead of a bare link that appears
 * to hang.
 */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/icon-chip";

export type ResearchVisualKind = "infographic" | "poster" | "graphical-abstract" | "framework";

export function researchVisualUrl(articleId: string, kind: ResearchVisualKind, inline = false): string {
  return `/api/articles/${articleId}/visuals/${kind}${inline ? "?inline=1" : ""}`;
}

export function ResearchVisualButton({
  articleId,
  kind,
  label,
  icon,
  variant = "outline",
  size,
  className = "w-full justify-start",
}: {
  articleId: string;
  kind: ResearchVisualKind;
  label: string;
  icon: LucideIcon;
  variant?: "outline" | "default" | "secondary";
  size?: "sm" | "default";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(researchVisualUrl(articleId, kind));
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error || `Request failed (${res.status})`);
          }
          const blob = await res.blob();
          const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `${kind}.pdf`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (e: any) {
          toast.error(`${label} not available`, { description: e.message });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconChip icon={icon} />}
      {busy ? "Preparing…" : label}
    </Button>
  );
}
