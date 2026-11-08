"use client";

import { useEffect, useState } from "react";
import { enterWorkspaceIfNeeded, announceSessionChange } from "@/lib/workspace-client";
import { useTranslations } from "next-intl";
import { takeReturnTab, useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User as UserIcon, Building2, Globe2, Tag, BookOpen, ArrowLeft, KeyRound, ShieldCheck, MailCheck, Fingerprint } from "lucide-react";

// Only roles a registrant can grant themselves — matches the backend's
// SELF_SELECTABLE_ROLES in src/app/api/auth/register/route.ts. Reviewer,
// editor, and admin access are invited/promoted by the editorial office,
// never self-service.
const ROLES = [
  { value: "READER", label: "Reader — subscribe and read articles" },
  { value: "AUTHOR", label: "Author — submit manuscripts" },
  { value: "REVIEWER", label: "Peer Reviewer — requires qualification review" },
  { value: "EDITOR", label: "Editor — requires qualification review" },
];

export function AuthView() {
  const { view, setView, setAuth, openDashboard } = useApp();
  const [loading, setLoading] = useState(false);
  const t = useTranslations("auth");

  // Referral program — a referral link is "<site>/?ref=<code>&view=register"
  // (or just carries ?ref= into whatever URL leads here); read once on
  // mount rather than on every render, since the query string is only
  // meaningful at the moment this page was reached, not after a form edit.
  const [referralCode] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null
  );

  // Optional sign-in methods this deployment offers, and errors from them.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    apiFetch<{ google: boolean }>("/api/auth/providers").then((r) => setGoogleEnabled(r.google)).catch(() => {});
    const err = new URLSearchParams(window.location.search).get("error");
    const messages: Record<string, string> = {
      google_2fa: "This account uses two-step sign-in. Sign in with your password or a passkey instead.",
      google_unverified: "Google didn't confirm that email address.",
      google_state: "That sign-in link expired. Please try again.",
      google_token: "Google sign-in didn't complete. Please try again.",
      google_unreachable: "Couldn't reach Google. Please try again.",
      google_unavailable: "Google sign-in isn't available here.",
      account_closed: "That account has been closed.",
      account_locked: "Sign-in is paused after failed attempts. Try again later.",
    };
    if (err && messages[err]) toast.error(messages[err]);
  }, []);

  // Passkey sign-in (src/lib/passkeys.ts): Face ID, Touch ID, Windows Hello, phone or security key.
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  async function signInWithPasskey() {
    setPasskeyBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optionsJSON = await apiFetch<any>("/api/auth/passkeys/login/options", { method: "POST" });
      const response = await startAuthentication({ optionsJSON });
      const res = await apiFetch<{ user: any }>("/api/auth/passkeys/login/verify", { method: "POST", body: JSON.stringify({ response }) });
      setAuth(res.user);
      toast.success(`Welcome back, ${res.user.fullName.split(" ")[0]}`);
      announceSessionChange();
      if (enterWorkspaceIfNeeded(res.user)) return;
      openDashboard(takeReturnTab());
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") toast.error("Passkey sign-in failed", { description: e?.message });
    } finally {
      setPasskeyBusy(false);
    }
  }

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // "Forgot password?" — replaces the sign-in form in the same card.
  // "/?view=login&forgot=1" (the reset page's "request a new link") opens it directly.
  const [forgotMode, setForgotMode] = useState<boolean>(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("forgot") === "1"
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("forgot")) return;
    params.delete("forgot");
    const rest = params.toString();
    window.history.replaceState({}, "", rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
  }, []);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSentTo, setForgotSentTo] = useState<string | null>(null);

  // Two-factor challenge step (only entered when login reports twoFactorRequired)
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorEmail, setTwoFactorEmail] = useState<{ sentTo: string; delivered: boolean } | null>(null);
  const [resending, setResending] = useState(false);

  // Register form
  const [reg, setReg] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "AUTHOR",
    affiliation: "",
    expertise: "",
    country: "",
  });

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{
        user?: any;
        twoFactorRequired?: boolean;
        pendingToken?: string;
        method?: "totp" | "email";
        sentTo?: string;
        emailDelivered?: boolean;
      }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      if (res.twoFactorRequired && res.pendingToken) {
        setPendingToken(res.pendingToken);
        setTwoFactorCode("");
        setTwoFactorEmail(res.method === "email" ? { sentTo: res.sentTo ?? "", delivered: !!res.emailDelivered } : null);
        return;
      }
      setAuth(res.user);
      toast.success(`Welcome back, ${res.user.fullName.split(" ")[0]}`);
      announceSessionChange();
      if (enterWorkspaceIfNeeded(res.user)) return;
      openDashboard(takeReturnTab());
    } catch (e: any) {
      toast.error("Sign in failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!email) return;
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setForgotSentTo(email);
    } catch (e: any) {
      toast.error("Couldn't send the reset link", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  function openForgot() {
    setForgotEmail(loginEmail);
    setForgotSentTo(null);
    setForgotMode(true);
  }

  async function submitTwoFactorChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ user: any }>("/api/auth/2fa/challenge", {
        method: "POST",
        body: JSON.stringify({ pendingToken, token: twoFactorCode }),
      });
      setAuth(res.user);
      setPendingToken(null);
      toast.success(`Welcome back, ${res.user.fullName.split(" ")[0]}`);
      announceSessionChange();
      if (enterWorkspaceIfNeeded(res.user)) return;
      openDashboard(takeReturnTab());
    } catch (e: any) {
      toast.error("Verification failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function resendTwoFactorEmail() {
    if (!pendingToken) return;
    setResending(true);
    try {
      const res = await apiFetch<{ sentTo: string }>("/api/auth/2fa/email/resend", {
        method: "POST",
        body: JSON.stringify({ pendingToken }),
      });
      setTwoFactorEmail({ sentTo: res.sentTo, delivered: true });
      setTwoFactorCode("");
      toast.success(`New code sent to ${res.sentTo}`);
    } catch (e: any) {
      toast.error("Couldn't send a new code", { description: e.message });
    } finally {
      setResending(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ user: any; pendingApplication?: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(referralCode ? { ...reg, ref: referralCode } : reg),
      });
      setAuth(res.user);
      if (res.pendingApplication) {
        toast.success("Account created — please complete your qualification application");
        openDashboard("application");
      } else {
        toast.success(`Account created — welcome, ${res.user.fullName.split(" ")[0]}`);
        openDashboard("overview");
      }
    } catch (e: any) {
      toast.error("Registration failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  if (pendingToken) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={() => setPendingToken(null)} className="mb-6">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <Card className="paper-card">
          <CardHeader>
            <p className="eyebrow flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Two-factor authentication
            </p>
            <h1 className="font-display text-2xl font-semibold text-primary">Enter your code</h1>
            <p className="text-sm text-muted-foreground">
              {twoFactorEmail
                ? twoFactorEmail.delivered
                  ? `We emailed a 6-digit code to ${twoFactorEmail.sentTo}. It expires in 10 minutes.`
                  : "We couldn't email your code just now. Send a new one, or use one of your backup codes."
                : "Enter the 6-digit code from your authenticator app, or one of your backup codes."}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitTwoFactorChallenge} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tfa-code">Authentication code</Label>
                <Input
                  id="tfa-code"
                  autoFocus
                  required
                  value={twoFactorCode}
                  autoComplete="one-time-code"
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="h-10 font-mono tracking-widest"
                  placeholder="123456"
                />
                <p className="text-[0.65rem] text-muted-foreground">
                  {twoFactorEmail
                    ? "Check your spam folder if it isn't in your inbox. A backup code (e.g. AB12C-D3E4F) also works."
                    : "Enter your 6-digit authenticator code, or a backup code (e.g. AB12C-D3E4F) if you've lost access to your device."}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || twoFactorCode.length === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify and sign in
              </Button>
              {twoFactorEmail && (
                <Button type="button" variant="ghost" size="sm" className="w-full" disabled={resending} onClick={resendTwoFactorEmail}>
                  {resending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Email me a new code
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => setView("home")} className="mb-6">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("backToHome")}
      </Button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* LOGIN */}
        <Card className="paper-card">
          {forgotMode ? (
            <>
              <CardHeader>
                <p className="eyebrow flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> Account recovery
                </p>
                <h1 className="font-display text-2xl font-semibold text-primary">Reset your password</h1>
                <p className="text-sm text-muted-foreground">
                  Enter the email address you sign in with. We&apos;ll email you a link to choose a new password.
                </p>
              </CardHeader>
              <CardContent>
                {forgotSentTo ? (
                  <div className="space-y-4" role="status" aria-live="polite">
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-4">
                      <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="text-sm leading-relaxed">
                        <p className="font-medium text-foreground">Check your inbox</p>
                        <p className="mt-1 text-muted-foreground">
                          If an account exists for <span className="font-medium text-foreground">{forgotSentTo}</span>, a reset link is on its
                          way. It works once and expires in 30 minutes. Not there in a few minutes? Check your spam folder.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setForgotSentTo(null)} disabled={loading}>
                        Send another link
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setForgotMode(false)}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to sign in
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitForgot} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fp-email" className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> {t("emailLabel")}
                      </Label>
                      <Input
                        id="fp-email"
                        type="email"
                        required
                        autoFocus
                        autoComplete="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || !forgotEmail.trim()}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send reset link
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotMode(false)}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to sign in
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : (
          <>
          <CardHeader>
            <p className="eyebrow">{t("signInEyebrow")}</p>
            <h1 className="font-display text-2xl font-semibold text-primary">
              {t("returningUser")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("signInHint")}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="li-email" className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {t("emailLabel")}
                </Label>
                <Input
                  id="li-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="li-pass" className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> {t("passwordLabel")}
                  </Label>
                  <button
                    type="button"
                    onClick={openForgot}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="li-pass"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-10"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("signInButton")}
              </Button>
            </form>

            {/* ORCID OAuth */}
            <div className="mt-4">
              <Separator className="mb-3" />
              <Button type="button" variant="outline" className="mb-2 w-full" disabled={passkeyBusy} onClick={signInWithPasskey}>
                {passkeyBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
                Sign in with a passkey
              </Button>
              {googleEnabled && (
                <a href="/api/auth/google" className="mb-2 block">
                  <Button type="button" variant="outline" className="w-full">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    Continue with Google
                  </Button>
                </a>
              )}
              <a href="/api/auth/orcid" className="block">
                <Button type="button" variant="outline" className="w-full bg-[#a6ce39] text-[#373737] hover:bg-[#94c62f] hover:text-[#373737] border-[#a6ce39]">
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zM88.7 58.1h15.4v15.4H88.7V58.1zm0 30.8h15.4v109.1H88.7V88.9zm39.3 0h15.4v6.7c5.5-5.2 12.6-8.4 21-8.4 19.5 0 35.3 15.8 35.3 35.3s-15.8 35.3-35.3 35.3c-8.4 0-15.5-3.2-21-8.4v48.6H128V88.9zm15.4 15.4v35.3c4.2 4.2 10 6.7 16.4 6.7 12.7 0 23-10.3 23-23s-10.3-23-23-23c-6.4 0-12.2 2.5-16.4 6.7z"/>
                  </svg>
                  Sign in with ORCID
                </Button>
              </a>
              <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">
                Auto-populates your profile from your ORCID record. Your publications are auto-synced on publication.
              </p>
            </div>

          </CardContent>
          </>
          )}
        </Card>

        {/* REGISTER */}
        <Card className="paper-card">
          <CardHeader>
            <p className="eyebrow">{t("registerEyebrow")}</p>
            <h1 className="font-display text-2xl font-semibold text-primary">
              {t("newAccount")}
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a role. You can request additional roles from the editorial office later.
            </p>
            {referralCode && (
              <p className="mt-2 text-xs font-medium text-primary">
                You were invited by a member of the Eleventh Press community.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={submitRegister} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="flex items-center gap-1.5">
                  <UserIcon className="h-3 w-3" /> {t("fullNameLabel")}
                </Label>
                <Input
                  id="reg-name"
                  required
                  value={reg.fullName}
                  onChange={(e) => setReg({ ...reg, fullName: e.target.value })}
                  className="h-10"
                  placeholder="Dr. Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {t("emailLabel")}
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  required
                  value={reg.email}
                  onChange={(e) => setReg({ ...reg, email: e.target.value })}
                  className="h-10"
                  placeholder="jane.doe@university.edu"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-pass" className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> {t("passwordLabel")}
                </Label>
                <Input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={4}
                  value={reg.password}
                  onChange={(e) => setReg({ ...reg, password: e.target.value })}
                  className="h-10"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-role" className="flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" /> {t("roleLabel")}
                </Label>
                <Select value={reg.role} onValueChange={(v) => setReg({ ...reg, role: v })}>
                  <SelectTrigger id="reg-role" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(reg.role === "REVIEWER" || reg.role === "EDITOR") && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
                  <p className="font-medium">Qualification review required</p>
                  <p className="mt-1">
                    After registration, you will need to upload your professional resume,
                    transcript of records, certificates (research/peer reviewer/grammarian/statistician/PRC ID),
                    and verified ORCID iD. Your application will be reviewed by the editorial board.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-aff" className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> {t("affiliationLabel")}
                  </Label>
                  <Input
                    id="reg-aff"
                    value={reg.affiliation}
                    onChange={(e) => setReg({ ...reg, affiliation: e.target.value })}
                    className="h-10"
                    placeholder="University"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-country" className="flex items-center gap-1.5">
                    <Globe2 className="h-3 w-3" /> {t("countryLabel")}
                  </Label>
                  <Input
                    id="reg-country"
                    value={reg.country}
                    onChange={(e) => setReg({ ...reg, country: e.target.value })}
                    className="h-10"
                    placeholder="Country"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-exp" className="flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Expertise (comma-separated keywords)
                </Label>
                <Input
                  id="reg-exp"
                  value={reg.expertise}
                  onChange={(e) => setReg({ ...reg, expertise: e.target.value })}
                  className="h-10"
                  placeholder="machine learning, computer vision"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <KeyRound className="mr-1.5 h-4 w-4" /> {t("createAccountButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
