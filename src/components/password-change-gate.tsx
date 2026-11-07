"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { useTenantBranding } from "@/lib/tenant-branding-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, LogOut, Eye, EyeOff } from "lucide-react";

const MIN = 8;

/**
 * First sign-in with a temporary password (an account an administrator
 * created, e.g. a new tenant admin): choose a personal password before
 * anything else. Rendered by MfaGate ahead of the 2FA setup step.
 */
export function PasswordChangeGate() {
  const { user, setAuth, logout } = useApp();
  const branding = useTenantBranding();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current.length > 0 && next.length >= MIN && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (user) setAuth({ ...user, mustChangePassword: false });
      toast.success("Password updated");
    } catch (err: any) {
      toast.error("Couldn't update your password", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  const org = branding.siteName || branding.tenantName || "Eleventh Press";

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="paper-card w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <p className="eyebrow">Welcome to {org}</p>
          </div>
          <h2 className="font-display text-xl font-semibold">Choose your own password</h2>
          <p className="text-sm text-muted-foreground">
            You signed in with a temporary password. Set a personal one to continue to your dashboard.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pcg-current">Temporary password</Label>
              <Input id="pcg-current" type={show ? "text" : "password"} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pcg-new">New password</Label>
              <div className="relative">
                <Input id="pcg-new" type={show ? "text" : "password"} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide passwords" : "Show passwords"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={`text-xs ${tooShort ? "text-destructive" : "text-muted-foreground"}`}>At least {MIN} characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pcg-confirm">Confirm new password</Label>
              <Input id="pcg-confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy || !ready}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save password &amp; continue
            </Button>
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={logout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out instead
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
