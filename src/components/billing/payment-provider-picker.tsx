"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard } from "lucide-react";

interface ProviderInfo {
  id: string;
  label: string;
  liveMode: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (providerId: string) => void;
  busy?: boolean;
}

/** Shared "choose a payment method" dialog — used for both APC and subscription checkout. */
export function PaymentProviderPicker({ open, onOpenChange, onSelect, busy }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ providers: ProviderInfo[] }>("/api/billing/providers")
      .then(({ providers }) => setProviders(providers))
      .catch(() => setProviders([]));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose a payment method</DialogTitle>
          <DialogDescription>
            All five gateways are wired up end-to-end. Any without live API keys yet run in
            simulation mode — you'll still see the full checkout flow, no real charge occurs.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-2">
          {providers === null && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {providers?.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => onSelect(p.id)}
              className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {p.label}
              </span>
              <Badge
                variant="outline"
                className={
                  p.liveMode
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.6rem]"
                    : "border-amber-300 bg-amber-50 text-amber-700 text-[0.6rem]"
                }
              >
                {p.liveMode ? "Live" : "Simulation"}
              </Badge>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
