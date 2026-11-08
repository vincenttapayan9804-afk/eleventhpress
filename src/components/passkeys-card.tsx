"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface Passkey { id: string; name: string; createdAt: string; lastUsedAt: string | null }

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Profile → Passkeys: add, list and remove passkeys for passwordless sign-in. */
export function PasskeysCard() {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  const load = useCallback(() => {
    apiFetch<{ passkeys: Passkey[] }>("/api/auth/passkeys").then((r) => setList(r.passkeys)).catch(() => setList([]));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(browserSupportsWebAuthn());
    load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      const optionsJSON = await apiFetch<any>("/api/auth/passkeys/register/options", { method: "POST" });
      const response = await startRegistration({ optionsJSON });
      await apiFetch("/api/auth/passkeys/register/verify", { method: "POST", body: JSON.stringify({ response }) });
      toast.success("Passkey added — you can now sign in without a password");
      load();
    } catch (e: any) {
      if (e?.name === "NotAllowedError") toast.message("Passkey setup was cancelled");
      else if (e?.name === "InvalidStateError") toast.message("This device already has a passkey for your account");
      else toast.error("Couldn't add the passkey", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="paper-card" id="passkeys">
      <CardHeader>
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Fingerprint className="h-4 w-4 text-primary" /> Passkeys</h3>
        <p className="text-xs text-muted-foreground">
          Sign in with Face ID, Touch ID, Windows Hello or your phone — no password to type, and nothing a phishing site can steal.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {list && list.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Added {fmt(p.createdAt)}{p.lastUsedAt ? ` · last used ${fmt(p.lastUsedAt)}` : ""}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Remove passkey ${p.name}`}
                  onClick={async () => {
                    await apiFetch(`/api/auth/passkeys?id=${p.id}`, { method: "DELETE" }).catch(() => {});
                    toast.success("Passkey removed");
                    load();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {supported ? (
          <Button size="sm" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-1.5 h-4 w-4" />}
            {list && list.length ? "Add another passkey" : "Create a passkey"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">This browser doesn&rsquo;t support passkeys.</p>
        )}
      </CardContent>
    </Card>
  );
}
