"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, Mail, Smartphone, ArrowLeft, RotateCw } from "lucide-react";

export type TwoFactorMethod = "EMAIL" | "TOTP";

type Step =
  | { kind: "choose" }
  | { kind: "email"; sentTo: string }
  | { kind: "totp"; secret: string; qrCode: string }
  | { kind: "codes"; codes: string[]; method: TwoFactorMethod };

/**
 * Two-factor enrollment shared by the mandatory gate (src/components/
 * mfa-gate.tsx) and Profile → Security. Offers two methods: a code emailed
 * at each sign-in (no app needed) or an authenticator app. `onEnabled` fires
 * only after the one-time backup codes have been acknowledged, so a parent
 * that hides this component once 2FA is on never skips them.
 */
export function TwoFactorSetup({
  onEnabled,
  onCancel,
}: {
  onEnabled: (method: TwoFactorMethod) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<{ available: boolean }>("/api/auth/2fa/email/setup")
      .then((r) => alive && setEmailAvailable(r.available))
      .catch(() => alive && setEmailAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

  async function startEmail() {
    setBusy(true);
    try {
      const res = await apiFetch<{ sentTo: string }>("/api/auth/2fa/email/setup", { method: "POST" });
      setCode("");
      setStep({ kind: "email", sentTo: res.sentTo });
      toast.success(`Code sent to ${res.sentTo}`);
    } catch (e: any) {
      toast.error("Couldn't send the code", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function startTotp() {
    setBusy(true);
    try {
      const res = await apiFetch<{ secret: string; qrCode: string }>("/api/auth/2fa/setup", { method: "POST" });
      setCode("");
      setStep({ kind: "totp", ...res });
    } catch (e: any) {
      toast.error("Couldn't start setup", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(method: TwoFactorMethod) {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ backupCodes: string[] }>("/api/auth/2fa/confirm", {
        method: "POST",
        body: JSON.stringify({ token: code, method: method === "EMAIL" ? "email" : "totp" }),
      });
      setStep({ kind: "codes", codes: res.backupCodes, method });
      toast.success("Two-factor authentication enabled");
    } catch (e: any) {
      toast.error("Invalid code", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  const codeInput = (id: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        6-digit code
      </Label>
      <Input
        id={id}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="text-center font-mono text-lg tracking-widest"
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
      />
    </div>
  );

  const back = (
    <Button type="button" variant="ghost" size="sm" onClick={() => setStep({ kind: "choose" })}>
      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Choose another method
    </Button>
  );

  if (step.kind === "codes") {
    return (
      <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
          <KeyRound className="h-4 w-4" /> Save your backup codes
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Each code can be used once to sign in if you can&apos;t get a code
          {step.method === "EMAIL" ? " by email" : " from your authenticator app"}. They won&apos;t be shown again —
          copy them somewhere safe.
        </p>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          {step.codes.map((c) => (
            <span key={c} className="rounded border border-amber-300 bg-white px-2 py-1 text-center text-foreground dark:bg-background">
              {c}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigator.clipboard?.writeText(step.codes.join("\n")).then(() => toast.success("Backup codes copied"))}
          >
            Copy codes
          </Button>
          <Button type="button" size="sm" onClick={() => onEnabled(step.method)}>
            I&apos;ve saved these — continue
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "email") {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          We emailed a 6-digit code to <span className="font-medium">{step.sentTo}</span>. Enter it below. It expires in 10
          minutes — check your spam folder if it isn&apos;t in your inbox.
        </p>
        {codeInput("tfa-setup-email-code")}
        <Button type="button" className="w-full" disabled={busy || code.length !== 6} onClick={() => confirm("EMAIL")}>
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Confirm &amp; enable
        </Button>
        <div className="flex flex-wrap justify-between gap-2">
          {back}
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={startEmail}>
            <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Send a new code
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "totp") {
    return (
      <div className="space-y-3">
        <div className="flex justify-center">
          <img src={step.qrCode} alt="Two-factor authentication QR code" className="h-40 w-40 rounded-md border border-border bg-white" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Scan with any authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password), or enter this
          key manually: <code className="break-all font-mono text-[0.65rem]">{step.secret}</code>
        </p>
        {codeInput("tfa-setup-totp-code")}
        <Button type="button" className="w-full" disabled={busy || code.length !== 6} onClick={() => confirm("TOTP")}>
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Confirm &amp; enable
        </Button>
        {back}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose how you&apos;d like to receive your sign-in codes:</p>
      <button
        type="button"
        disabled={busy || emailAvailable !== true}
        onClick={startEmail}
        className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-transparent"
      >
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Email me a code {emailAvailable && <span className="text-xs font-normal text-primary">· no app needed</span>}</span>
          <span className="block text-xs text-muted-foreground">
            {emailAvailable === false
              ? "Not available yet — email delivery hasn't been set up on this platform."
              : "Each time you sign in, we email a 6-digit code to your account's address."}
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={startTotp}
        className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
      >
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Use an authenticator app</span>
          <span className="block text-xs text-muted-foreground">
            Free apps such as Google Authenticator or Microsoft Authenticator show a new code every 30 seconds, even offline.
          </span>
        </span>
      </button>
      {onCancel && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
