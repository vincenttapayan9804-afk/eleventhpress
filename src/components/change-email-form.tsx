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
  const [taken, setTaken] = useState<{ email: string; holder: Holder | null } | null>(null);

  async function start(e?: React.FormEvent, opts: { email?: string; release?: boolean } = {}) {
    e?.preventDefault();
    const body = opts.email ? { ...form, newEmail: opts.email, confirmEmail: opts.email } : form;
    setBusy(true);
    try {
      const res = await apiFetch<{ mode: "code" | "changed"; sentTo?: string; user?: any }>("/api/auth/change-email/start", {
        method: "POST",
        body: JSON.stringify(opts.release ? { ...body, releaseFromOtherAccount: true } : body),
      });
      setTaken(null);
      if (res.mode === "changed" && res.user) {
        toast.success("Sign-in email changed", { description: `Sign in with ${res.user.email} from now on.` });
        onChanged(res.user);
        return;
      }
      setCode("");
      setCodeSentTo(res.sentTo ?? body.newEmail);
      toast.success(`Code sent to ${res.sentTo ?? body.newEmail}`);
    } catch (err: any) {
      if (err?.body?.code === "EMAIL_TAKEN") {
        setTaken({ email: body.newEmail.trim(), holder: err.body.holder ?? null });
        return;
      }
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
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => start(undefined, { email: codeSentTo })}>
            Send a new code
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => (onCancel ? onCancel() : setCodeSentTo(null))}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const alias = taken ? plusAlias(taken.email, taken.holder ? "admin" : "login") : null;

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
            onChange={(e) => {
              setForm({ ...form, newEmail: e.target.value });
              setTaken(null);
            }}
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
      {taken && (
        <div role="alert" className="space-y-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="text-sm font-medium">
            <span className="break-all">{taken.email}</span> already belongs to another account
          </p>
          {taken.holder && (
            <>
              <p>
                It&apos;s held by <span className="font-medium">{taken.holder.fullName}</span> ({roleLabel(taken.holder.role)}
                {taken.holder.tenantName ? `, ${taken.holder.tenantName}` : ""}), created{" "}
                {new Date(taken.holder.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                {taken.holder.submissions > 0
                  ? ` with ${taken.holder.submissions} submission${taken.holder.submissions === 1 ? "" : "s"}`
                  : ", no submissions"}
                . If that&apos;s an old account of yours, you can take the address over. That account keeps its work and role
                but can no longer sign in with this address.
              </p>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy || !form.password}
                onClick={() => start(undefined, { email: taken.email, release: true })}
              >
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Take over this address
              </Button>
            </>
          )}
          {alias && (
            <div className="space-y-1.5">
              <p>
                {taken.holder ? "Or keep both accounts: use " : "You can use "}
                <span className="break-all font-medium">{alias}</span> instead. Mail sent to it still arrives in the same inbox.
              </p>
              <Button type="button" size="sm" variant="outline" disabled={busy || !form.password} onClick={() => start(undefined, { email: alias })}>
                Use {alias}
              </Button>
            </div>
          )}
          {!taken.holder && !alias && <p>Use a different address, or sign in to that account instead.</p>}
        </div>
      )}
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

type Holder = { fullName: string; role: string; tenantName: string | null; createdAt: string; submissions: number };

const PLUS_ALIAS_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "fastmail.com",
]);

/** name+admin@gmail.com style alias that still reaches the same inbox, for providers that support it. */
function plusAlias(email: string, tag: string): string | null {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain || local.includes("+") || !PLUS_ALIAS_DOMAINS.has(domain)) return null;
  return `${local}+${tag}@${domain}`;
}

function roleLabel(role: string): string {
  return role.toLowerCase().replace(/_/g, " ");
}
