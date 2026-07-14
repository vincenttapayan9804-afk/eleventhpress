"use client";

import { useApp } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import { Loader2, KeyRound, User, Building2, Mail } from "lucide-react";

interface DemoAccount {
  email: string;
  password: string;
  label: string;
  description: string;
  icon: any;
  accent: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@eleventhpress.org",
    password: "admin",
    label: "Editor-in-Chief",
    description: "Eleanor Vance — Super Admin. Full oversight: editorial queue, indexing dashboard, audit log, billing.",
    icon: Building2,
    accent: "bg-primary/10 text-primary border-primary/20",
  },
  {
    email: "editor@eleventhpress.org",
    password: "editor",
    label: "Journal Editor",
    description: "Dr. Marcus Holloway. Manages submissions, assigns reviewers, transitions workflow, accepts/rejects.",
    icon: User,
    accent: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    email: "reviewer@eleventhpress.org",
    password: "reviewer",
    label: "Reviewer (Physics)",
    description: "Prof. Kenji Watanabe. Receives review invitations, completes double-blind review forms.",
    icon: User,
    accent: "bg-violet-100 text-violet-800 border-violet-200",
  },
  {
    email: "reviewer2@eleventhpress.org",
    password: "reviewer",
    label: "Reviewer (Sociology)",
    description: "Dr. Sofia Marenco. Reviews urban sociology and migration submissions.",
    icon: User,
    accent: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    email: "author@eleventhpress.org",
    password: "author",
    label: "Author",
    description: "Dr. Amara Okafor. Submits manuscripts, pays APC invoices, tracks review progress.",
    icon: User,
    accent: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    email: "reader@eleventhpress.org",
    password: "reader",
    label: "Reader (Subscriber)",
    description: "Liang Wei. Active yearly subscription — unlocks bundled downloads and early access; PDF galleys of published articles are free for everyone.",
    icon: User,
    accent: "bg-rose-100 text-rose-800 border-rose-200",
  },
];

export function AuthSheet() {
  const { authSheetOpen, setAuthSheetOpen, setAuth, setView, openDashboard } = useApp();
  const [loading, setLoading] = useState<string | null>(null);

  async function signIn(acct: DemoAccount) {
    setLoading(acct.email);
    try {
      const res = await apiFetch<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: acct.email, password: acct.password }),
      });
      setAuth(res.token, res.user);
      setAuthSheetOpen(false);
      toast.success(`Signed in as ${res.user.fullName}`, {
        description: `Role: ${res.user.role.replace(/_/g, " ")}`,
      });
      openDashboard("overview");
    } catch (e: any) {
      toast.error("Sign in failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Sheet open={authSheetOpen} onOpenChange={setAuthSheetOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-primary">
            Sign in to the journal
          </SheetTitle>
          <SheetDescription>
            Choose one of the demo accounts below to explore the platform as a
            specific role. Each role unlocks a different dashboard view of the
            editorial workflow.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {DEMO_ACCOUNTS.map((acct) => {
            const Icon = acct.icon;
            return (
              <Card
                key={acct.email}
                className="cursor-pointer border-border transition-all hover:border-primary/40 hover:shadow-sm"
                onClick={() => signIn(acct)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${acct.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-semibold">{acct.label}</p>
                      <Badge variant="outline" className="font-mono text-[0.6rem]">
                        {acct.email.split("@")[0]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {acct.description}
                    </p>
                    <p className="mt-2 flex items-center gap-1 font-mono text-[0.65rem] text-muted-foreground">
                      <KeyRound className="h-3 w-3" /> password: <span className="text-foreground">{acct.password}</span>
                    </p>
                  </div>
                  {loading === acct.email && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAuthSheetOpen(false);
              setView("register");
            }}
          >
            <Mail className="mr-2 h-4 w-4" /> Register a new account
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
