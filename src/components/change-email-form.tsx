"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Changes the signed-in account's sign-in email. With email delivery set up
 * it confirms the new address with an emailed code; otherwise the change
 * applies after the password check (src/lib/change-email.ts).
 */
export function ChangeEmailForm({
  currentEmail,
  onChanged,
  onCancel,
}: {
  currentEmail: string;
  onChanged: (user: any) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({ newEmail: "", confirmEmail: "", password: "" });
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function start(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch<{ mode: "code" | "changed"; sentTo?: string; user?: any }>("/api/auth/change-email/start", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (res.mode === "changed" && res.user) {
        toast.success("Sign-in email changed", { description: `Sign in with ${res.user.email} from now on.` });
        onChanged(res.user);
        return;
      }
      setCode("");
      setCodeSentTo(res.sentTo ?? form.newEmail);
      toast.success(`Code sent to ${res.sentTo ?? form.newEmail}`);
    } catch (err: any) {
      toast.error("Couldn't change your email", { description: String(err.message || "").replace(/^\w+: /, "") });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ user: any }>("/api/auth/change-email/confirm", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      toast.success("Sign-in email changed", { description: `Sign in with ${res.user.email} from now on.` });
      onChanged(res.user);
    } catch (err: any) {
      toast.error("Invalid code", { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (codeSentTo) {
    return (
      <form onSubmit={confirm} className="space-y-3">
        <p className="text-sm">
          We emailed a 6-digit code to <span className="font-medium">{codeSentTo}</span>. Enter it to finish — your sign-in
          email stays <span className="font-medium">{currentEmail}</span> until you do.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="ce-code" className="text-xs">
            6-digit code
          </Label>
          <Input
            id="ce-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="max-w-[12rem] text-center font-mono text-lg tracking-widest"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirm new email
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => start()}>
            Send a new code
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => (onCancel ? onCancel() : setCodeSentTo(null))}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const mismatch = form.confirmEmail.length > 0 && form.confirmEmail.trim().toLowerCase() !== form.newEmail.trim().toLowerCase();

  return (
    <form onSubmit={start} className="max-w-md space-y-3">
      <p className="text-xs text-muted-foreground">
        Currently <span className="font-medium text-foreground">{currentEmail}</span>. Use an inbox you can open — sign-in codes
        and password resets go there.
      </p>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ce-new">New email</Label>
          <Input
            id="ce-new"
            type="email"
            required
            autoComplete="email"
            value={form.newEmail}
            onChange={(e) => setForm({ ...form, newEmail: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-confirm">Type it again</Label>
          <Input
            id="ce-confirm"
            type="email"
            required
            autoComplete="off"
            value={form.confirmEmail}
            onChange={(e) => setForm({ ...form, confirmEmail: e.target.value })}
            aria-invalid={mismatch || undefined}
          />
          {mismatch && <p className="text-[0.7rem] text-destructive">The two addresses don&apos;t match.</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ce-pass">Your current password</Label>
        <Input
          id="ce-pass"
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || mismatch || !form.newEmail.trim() || !form.password}>
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Change email
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
