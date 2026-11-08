"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, Smartphone, MonitorSmartphone, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface Row { id: string; device: string; location: string | null; createdAt: string; lastSeenAt: string; current: boolean }

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 300) return "Active now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const iconFor = (device: string) => (/iOS|Android/.test(device) ? Smartphone : /Windows|macOS|Linux/.test(device) ? Laptop : MonitorSmartphone);

/** Profile → "Where you're signed in": every active session, with sign-out per device or for all others. */
export function ActiveSessions() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ sessions: Row[] }>("/api/auth/sessions").then((r) => setRows(r.sessions)).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const signOut = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/api/auth/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setRows((r) => r?.filter((x) => x.id !== id) ?? r);
      toast.success("Signed out of that device");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const signOutOthers = async () => {
    setBusy("others");
    try {
      const r = await apiFetch<{ count: number }>("/api/auth/sessions", { method: "POST", body: JSON.stringify({ action: "signOutOthers" }) });
      toast.success(r.count ? `Signed out of ${r.count} other device${r.count === 1 ? "" : "s"}` : "Signed out everywhere else");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const others = rows?.filter((r) => !r.current).length ?? 0;

  return (
    <Card className="paper-card" id="sessions">
      <CardHeader>
        <h3 className="font-display text-lg font-semibold">Where you&rsquo;re signed in</h3>
        <p className="text-xs text-muted-foreground">If you don&rsquo;t recognise a device, sign it out and change your password.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!rows ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Only this device.</li>}
            {rows.map((r) => {
              const Icon = iconFor(r.device);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {r.device}
                      {r.current && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">This device</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[r.location, r.current ? "Active now" : ago(r.lastSeenAt), `signed in ${new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {!r.current && (
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => signOut(r.id)}>
                      {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" size="sm" disabled={busy === "others" || (rows !== null && others === 0)} onClick={signOutOthers}>
          {busy === "others" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
          Sign out of all other devices
        </Button>
      </CardContent>
    </Card>
  );
}
