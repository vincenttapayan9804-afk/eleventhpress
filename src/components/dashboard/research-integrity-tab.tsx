"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

interface SyncMeta {
  lastSyncedAt: string | null;
  recordCount: number;
  lastError: string | null;
}

export function ResearchIntegrityTab() {
  const [meta, setMeta] = useState<SyncMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ meta: SyncMeta | null }>("/api/admin/retraction-watch/sync");
      setMeta(res.meta);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true);
    try {
      const res = await apiFetch<{ success: boolean; recordCount: number; error: string | null }>(
        "/api/admin/retraction-watch/sync",
        { method: "POST" }
      );
      if (res.success) {
        toast.success(`Synced ${res.recordCount.toLocaleString()} retraction records`);
      } else {
        toast.error("Sync failed", { description: res.error || undefined });
      }
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Research integrity — Retraction Watch</h2>
        <p className="text-sm text-muted-foreground">
          Cross-references every article&apos;s resolved citations against the real, free Retraction Watch Database
          (Crossref&apos;s public CSV mirror — no API key, no per-check cost) so a citation to a since-retracted paper
          shows up on the article page instead of going unnoticed.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  {meta?.lastSyncedAt ? (
                    <>
                      <p className="text-sm font-medium">
                        {meta.recordCount.toLocaleString()} retraction records synced
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last synced {new Date(meta.lastSyncedAt).toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">Never synced yet</p>
                  )}
                </div>
                {meta?.lastError && <Badge className="ml-auto bg-red-100 text-red-800">Last attempt failed</Badge>}
              </div>
              {meta?.lastError && (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{meta.lastError}</p>
              )}
              <Button size="sm" disabled={syncing} onClick={sync}>
                {syncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                {syncing ? "Syncing (this can take a minute)…" : "Sync now"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
