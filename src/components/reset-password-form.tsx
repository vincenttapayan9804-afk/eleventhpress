"use client";

// The "choose a new password" form behind the emailed reset link
// (src/app/reset-password/page.tsx, /api/auth/reset-password).

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type State =
  | { kind: "checking" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; email: string; minLength: number }
  | { kind: "done"; twoFactorEnabled: boolean };

const FALLBACK_MIN = 8;

/** 0–4, for the strength meter only; the server enforces the real rules. */
function strength(pw: string, min: number): number {
  if (pw.length < min) return pw.length ? 1 : 0;
  let score = 2;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 10) score = Math.min(4, score + 1);
  return Math.min(4, score);
}

const STRENGTH = [
  { label: "", cls: "bg-border" },
  { label: "Too short", cls: "bg-red-500" },
  { label: "Fair", cls: "bg-amber-500" },
  { label: "Good", cls: "bg-emerald-500" },
  { label: "Strong", cls: "bg-emerald-600" },
];

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    // Keep the token out of the address bar (and history) once read.
    window.history.replaceState({}, "", "/reset-password");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- token only exists in the browser URL
    setToken(t);
    if (!t) {
      setState({ kind: "invalid", message: "This reset link is incomplete. Request a new one from the sign-in page." });
      return;
    }
    apiFetch<{ valid: boolean; email?: string; minLength?: number; message?: string }>(`/api/auth/reset-password?token=${encodeURIComponent(t)}`)
      .then((r) =>
        setState(
          r.valid
            ? { kind: "ready", email: r.email ?? "your account", minLength: r.minLength ?? FALLBACK_MIN }
            : { kind: "invalid", message: r.message ?? "This reset link is invalid or has expired." }
        )
      )
      .catch((e) => setState({ kind: "invalid", message: e?.message || "This reset link couldn't be checked. Please try again." }));
  }, []);

  const min = state.kind === "ready" ? state.minLength : FALLBACK_MIN;
  const score = strength(password, min);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = state.kind === "ready" && password.length >= min && password === confirm && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !token) return;
    setSaving(true);
    setError(null);
    try {
      const r = await apiFetch<{ ok: boolean; twoFactorEnabled?: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setState({ kind: "done", twoFactorEnabled: !!r.twoFactorEnabled });
    } catch (err: any) {
      const message = err?.message || "Your password couldn't be changed. Please try again.";
      if (/invalid or has expired/i.test(message)) setState({ kind: "invalid", message });
      else setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="paper-card">
      <CardHeader>
        <p className="eyebrow flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Account recovery
        </p>
        <h1 className="font-display text-2xl font-semibold text-primary">
          {state.kind === "done" ? "Password changed" : "Choose a new password"}
        </h1>
        {state.kind === "ready" && (
          <p className="text-sm text-muted-foreground">
            For <span className="font-medium text-foreground">{state.email}</span>. Use at least {state.minLength} characters; a longer
            passphrase is stronger.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {state.kind === "checking" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
          </p>
        )}

        {state.kind === "invalid" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm leading-relaxed text-amber-900 dark:text-amber-200" role="alert">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p>{state.message}</p>
            </div>
            <Button asChild className="w-full">
              <a href="/?view=login&forgot=1">Request a new reset link</a>
            </Button>
          </div>
        )}

        {state.kind === "done" && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-4 text-sm leading-relaxed">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-foreground">
                Your password has been changed. Sign in with your new password
                {state.twoFactorEnabled ? " and your two-factor code" : ""}. We&apos;ve also emailed you a confirmation.
              </p>
            </div>
            <Button asChild className="w-full">
              <a href="/?view=login&password_reset=1">Sign in</a>
            </Button>
          </div>
        )}

        {state.kind === "ready" && (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {/* Lets password managers save the new password against the right account. */}
            <input type="email" name="username" autoComplete="username" value={state.email} readOnly hidden />
            <div className="space-y-1.5">
              <Label htmlFor="rp-new" className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> New password
              </Label>
              <div className="relative">
                <Input
                  id="rp-new"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={min}
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10"
                  aria-describedby="rp-strength"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div id="rp-strength" className="flex items-center gap-2" aria-live="polite">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= score ? STRENGTH[score].cls : "bg-border")} />
                  ))}
                </div>
                <span className="w-16 text-right text-[0.7rem] text-muted-foreground">{STRENGTH[score].label}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm" className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Confirm new password
              </Label>
              <Input
                id="rp-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                maxLength={200}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10"
                aria-invalid={mismatch}
              />
              {mismatch && <p className="text-xs text-destructive">The passwords don&apos;t match.</p>}
            </div>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
