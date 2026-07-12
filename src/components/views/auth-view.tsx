"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
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
import { Loader2, Mail, Lock, User as UserIcon, Building2, Globe2, Tag, BookOpen, ArrowLeft, KeyRound } from "lucide-react";

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

// Demo account credentials are only ever a local convenience — showing
// plaintext admin/editor/reviewer passwords on a public login page in
// production would hand out real privileged access. Opt-in only, via an
// env var set for demo/staging deployments.
const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

export function AuthView() {
  const { view, setView, setAuth, openDashboard } = useApp();
  const [loading, setLoading] = useState(false);
  const t = useTranslations("auth");

  // Login form
  const [loginEmail, setLoginEmail] = useState(SHOW_DEMO_ACCOUNTS ? "author@eleventhpress.org" : "");
  const [loginPassword, setLoginPassword] = useState(SHOW_DEMO_ACCOUNTS ? "author" : "");

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
      const res = await apiFetch<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setAuth(res.token, res.user);
      toast.success(`Welcome back, ${res.user.fullName.split(" ")[0]}`);
      openDashboard("overview");
    } catch (e: any) {
      toast.error("Sign in failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: any; pendingApplication?: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(reg),
      });
      setAuth(res.token, res.user);
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => setView("home")} className="mb-6">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("backToHome")}
      </Button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* LOGIN */}
        <Card className="paper-card">
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
                <Label htmlFor="li-pass" className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> {t("passwordLabel")}
                </Label>
                <Input
                  id="li-pass"
                  type="password"
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

            {SHOW_DEMO_ACCOUNTS && (
              <div className="mt-6">
                <Separator className="mb-4" />
                <p className="mb-2 text-xs font-medium text-muted-foreground">Demo accounts:</p>
                <div className="grid grid-cols-2 gap-1.5 text-[0.7rem]">
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      key={a.email}
                      onClick={() => {
                        setLoginEmail(a.email);
                        setLoginPassword(a.password);
                      }}
                      className="rounded border border-border bg-muted/30 px-2 py-1.5 text-left font-mono hover:border-primary/40 hover:bg-muted/60"
                    >
                      <span className="font-semibold text-foreground">{a.role}</span>
                      <br />
                      <span className="text-muted-foreground">{a.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
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

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@eleventhpress.org", password: "admin" },
  { role: "Editor", email: "editor@eleventhpress.org", password: "editor" },
  { role: "Reviewer", email: "reviewer@eleventhpress.org", password: "reviewer" },
  { role: "Reviewer 2", email: "reviewer2@eleventhpress.org", password: "reviewer" },
  { role: "Author", email: "author@eleventhpress.org", password: "author" },
  { role: "Reader", email: "reader@eleventhpress.org", password: "reader" },
];
