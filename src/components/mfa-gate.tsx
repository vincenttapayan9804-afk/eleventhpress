"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { MFA_REQUIRED_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

/**
 * Blocks dashboard access for a privileged role (MFA_REQUIRED_ROLES, src/
 * lib/roles.ts) until two-factor authentication is actually turned on —
 * an enterprise-security baseline most SOC 2 reviews and procurement
 * questionnaires check specifically: not "is MFA offered" but "is MFA
 * mandatory for admin accounts." Reuses the exact same self-service TOTP
 * endpoints Profile → Security already exposes (/api/auth/2fa/setup,
 * /confirm) rather than a second enrollment path.
 *
 * Never locks an account out with no way forward: the account can still
 * sign out, and setup here is the same one-time flow Profile → Security
 * already offers — nothing about this screen is a dead end.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { user, setAuth, logout } = useApp();
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const mustSetUp = !!user && MFA_REQUIRED_ROLES.includes(user.role) && user.twoFactorEnabled === false;
  if (!mustSetUp) {
    return <>{children}</>;
  }

  async function startSetup() {
    setBusy(true);
    try {
      const res = await apiFetch<{ secret: string; qrCode: string }>("/api/auth/2fa/setup", { method: "POST" });
      setSetup(res);
    } catch (e: any) {
      toast.error("Couldn't start setup", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ backupCodes: string[] }>("/api/auth/2fa/confirm", {
        method: "POST",
        body: JSON.stringify({ token: code }),
      });
      setBackupCodes(res.backupCodes);
      if (user) setAuth({ ...user, twoFactorEnabled: true });
      toast.success("Two-factor authentication enabled");
    } catch (e: any) {
      toast.error("Invalid code", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="paper-card w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="eyebrow">Two-factor authentication required</p>
          </div>
          <h2 className="font-display text-xl font-semibold">Secure your account to continue</h2>
          <p className="text-sm text-muted-foreground">
            Accounts with your level of access ({user?.role.replace("_", " ").toLowerCase()}) require
            two-factor authentication before reaching the dashboard.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {backupCodes ? (
            <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <KeyRound className="h-4 w-4" /> Save your backup codes
              </p>
              <p className="text-xs text-amber-800">
                Each code can be used once to sign in if you lose access to your authenticator app.
                They won't be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                {backupCodes.map((c) => (
                  <div key={c} className="rounded border border-amber-300 bg-white px-2 py-1 text-center">
                    {c}
                  </div>
                ))}
              </div>
              <Button size="sm" className="w-full" onClick={() => setBackupCodes(null)}>
                I've saved these — continue
              </Button>
            </div>
          ) : setup ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <img src={setup.qrCode} alt="Two-factor authentication QR code" className="h-40 w-40 rounded-md border border-border" />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Scan with Google Authenticator, Authy, or 1Password, or enter this key manually:{" "}
                <code className="font-mono text-[0.65rem]">{setup.secret}</code>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-gate-code" className="text-xs">6-digit code</Label>
                <Input
                  id="mfa-gate-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-widest"
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              <Button className="w-full" disabled={busy || code.length !== 6} onClick={confirmSetup}>
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm &amp; enable
              </Button>
            </div>
          ) : (
            <Button className="w-full" disabled={busy} onClick={startSetup}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Set up two-factor authentication
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out instead
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
