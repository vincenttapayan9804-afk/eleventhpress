import type { Metadata } from "next";
import { CircleAlert, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { systemStatus, type ComponentState } from "@/lib/system-status";

export const metadata: Metadata = { title: "Platform status", description: "Live status of the website, email, payments and DOI registration." };
export const dynamic = "force-dynamic";

const STYLE: Record<ComponentState, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  operational: { label: "Operational", cls: "text-emerald-600", Icon: CircleCheck },
  limited: { label: "Limited", cls: "text-amber-600", Icon: CircleDashed },
  degraded: { label: "Degraded", cls: "text-amber-600", Icon: CircleAlert },
  down: { label: "Outage", cls: "text-rose-600", Icon: CircleX },
};

const HEADLINE: Record<ComponentState, string> = {
  operational: "All systems operational",
  limited: "All systems operational",
  degraded: "Some systems are slow",
  down: "We're having a problem",
};

/** /status — live platform health (src/lib/system-status.ts); /api/health is the machine-readable version. */
export default async function StatusPage() {
  const s = await systemStatus();
  const banner = s.overall === "operational" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : s.overall === "down" ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  return (
    <main className="min-h-dvh bg-background px-4 py-14">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm font-medium text-primary hover:underline">← Home</a>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">Platform status</h1>
        <div className={`mt-6 rounded-xl border px-5 py-4 font-medium ${banner}`}>{HEADLINE[s.overall]}</div>
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {s.components.map((c) => {
            const st = STYLE[c.state];
            return (
              <li key={c.key} className="flex items-center gap-4 px-5 py-4">
                <st.Icon className={`h-5 w-5 flex-shrink-0 ${st.cls}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.detail}</p>
                </div>
                <span className={`text-sm font-medium ${st.cls}`}>{st.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Checked {new Date(s.checkedAt).toUTCString()}. Refresh for the latest. Uptime monitors can poll <code className="font-mono">/api/health</code>.
        </p>
      </div>
    </main>
  );
}
