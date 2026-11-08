"use client";

import { useState } from "react";
import { Check, Circle, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, type DashboardTab } from "@/lib/store";
import { useTenantBranding } from "@/lib/tenant-branding-context";

interface Step {
  key: string;
  label: string;
  done: boolean;
  tab: DashboardTab;
}

const dismissKey = (userId: string) => `epip-onboarding-dismissed:${userId}`;
const visitedKey = (userId: string) => `epip-onboarding-visited:${userId}`;

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

/**
 * First-run checklist on the dashboard overview: the few steps that make an
 * account (and, for an institution's administrator, their platform) ready
 * to use. Disappears once everything is done, or when dismissed.
 */
export function OnboardingChecklist({ hasSubmissions }: { hasSubmissions: boolean }) {
  const user = useApp((s) => s.user);
  const openDashboard = useApp((s) => s.openDashboard);
  const branding = useTenantBranding();
  const [dismissed, setDismissed] = useState(() => (typeof window === "undefined" || !user ? true : localStorage.getItem(dismissKey(user.id)) === "1"));
  const [visited, setVisited] = useState<Set<string>>(() => (typeof window === "undefined" || !user ? new Set() : readSet(visitedKey(user.id))));
  if (!user || dismissed) return null;

  const role = user.role;
  const steps: Step[] = [
    { key: "verify", label: "Verify your email address", done: !!user.emailVerifiedAt, tab: "profile" },
    { key: "photo", label: "Add a profile photo", done: !!user.avatarUrl, tab: "profile" },
    { key: "about", label: "Add your affiliation and a short bio", done: !!user.affiliation && !!user.bio, tab: "profile" },
    { key: "orcid", label: "Link your ORCID iD", done: !!user.orcid, tab: "profile" },
    { key: "2fa", label: "Turn on two-step sign-in", done: !!user.twoFactorEnabled, tab: "profile" },
  ];
  if (role === "AUTHOR" || role === "EXPERT") {
    steps.push({ key: "submit", label: role === "EXPERT" ? "Submit your first Insight" : "Submit your first manuscript", done: hasSubmissions, tab: "submit" });
  }
  if (role === "REVIEWER") {
    steps.push({ key: "expertise", label: "List your areas of expertise so editors can match you", done: !!user.expertise, tab: "profile" });
  }
  if (role === "TENANT_ADMIN") {
    steps.push(
      { key: "logo", label: "Upload your institution's logo", done: !!branding.logoUrl, tab: "branding" },
      { key: "colours", label: "Set your brand colours", done: !!branding.primaryColor, tab: "branding" },
      { key: "contact", label: "Add your contact details", done: !!(branding.officialEmail || branding.supportEmail), tab: "branding" },
      { key: "team", label: "Invite your editorial team", done: visited.has("team"), tab: "team" }
    );
  }

  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);

  const open = (s: Step) => {
    if (s.key === "team") {
      const next = new Set(visited).add("team");
      setVisited(next);
      try {
        localStorage.setItem(visitedKey(user.id), JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
    }
    openDashboard(s.tab);
  };

  return (
    <section aria-labelledby="onboarding-heading" className="mb-5 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="onboarding-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ListChecks className="h-4 w-4 text-primary" /> Get set up
          </h2>
          <p className="text-xs text-muted-foreground">{done} of {steps.length} done</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Hide the setup checklist"
          onClick={() => {
            try {
              localStorage.setItem(dismissKey(user.id), "1");
            } catch {
              /* storage unavailable */
            }
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 grid gap-1 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              disabled={s.done}
              onClick={() => open(s)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors enabled:hover:bg-primary/5 disabled:cursor-default"
            >
              {s.done ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" /></span>
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/60" />
              )}
              <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
