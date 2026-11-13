"use client";

// Building blocks shared by the public verification pages — article
// provenance (/verify/article/[id]) and certificates (/verify/[serial]) —
// so both read as one system: the gold seal emblem, verdict panel styles,
// section cards, hash rows with a fingerprint strip, and copy helpers.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, CloudOff, Copy, Loader2, MinusCircle, ShieldCheck, XCircle } from "lucide-react";
import type { ProvenanceCheckResult, ProvenanceVerdict } from "@/lib/article-provenance-server";
import { cn } from "@/lib/utils";

export type VerifyVerdict = ProvenanceVerdict;
export type VerifyCheckResult = ProvenanceCheckResult;

/* ────────────────────────────────────────────────────────────────────────
 * Formatting helpers
 * ──────────────────────────────────────────────────────────────────────── */

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

export function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), timeout);
  }, [timeout]);
  return { copied, copy };
}

export const VERDICT_UI: Record<ProvenanceVerdict, {
  title: string;
  ring: string;
  panel: string;
  head: string;
  body: string;
  chip: string;
  Icon: typeof CheckCircle2;
}> = {
  verified: {
    title: "Verified — this record is authentic",
    ring: "text-emerald-600 dark:text-emerald-400",
    panel: "border-emerald-300/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:border-emerald-500/30 dark:from-emerald-950/50 dark:via-transparent dark:to-emerald-950/20",
    head: "text-emerald-900 dark:text-emerald-200",
    body: "text-emerald-800/90 dark:text-emerald-200/80",
    chip: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
    Icon: CheckCircle2,
  },
  unavailable: {
    title: "Verification temporarily unavailable",
    ring: "text-amber-600 dark:text-amber-400",
    panel: "border-amber-300/70 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 dark:border-amber-500/30 dark:from-amber-950/50 dark:via-transparent dark:to-amber-950/20",
    head: "text-amber-900 dark:text-amber-200",
    body: "text-amber-800/90 dark:text-amber-200/80",
    chip: "bg-amber-500 text-amber-950",
    Icon: CloudOff,
  },
  mismatch: {
    title: "Verification failed — hash mismatch",
    ring: "text-red-600 dark:text-red-400",
    panel: "border-red-300/70 bg-gradient-to-br from-red-50 via-white to-red-50/40 dark:border-red-500/30 dark:from-red-950/50 dark:via-transparent dark:to-red-950/20",
    head: "text-red-900 dark:text-red-200",
    body: "text-red-800/90 dark:text-red-200/80",
    chip: "bg-red-600 text-white",
    Icon: XCircle,
  },
};

/* ────────────────────────────────────────────────────────────────────────
 * Small building blocks
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Short publisher label for the seal ring: "ELEVENTH PRESS" for the
 * platform, otherwise the issuing tenant's name (trimmed to fit the ring).
 */
export function sealRingName(publisher: string | null | undefined): string {
  const p = (publisher ?? "").trim();
  if (!p || /^eleventh press( international publishing)?$/i.test(p)) return "ELEVENTH PRESS";
  const up = p.toUpperCase();
  return up.length > 24 ? `${up.slice(0, 23).trimEnd()}…` : up;
}

export function SealEmblem({
  verdict,
  spinning,
  ringText = "ELEVENTH PRESS · DIGITAL PROVENANCE · SHA-256 ·",
}: {
  verdict: ProvenanceVerdict;
  spinning: boolean;
  /** Text engraved around the seal's ring. */
  ringText?: string;
}) {
  const ui = VERDICT_UI[verdict];
  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center sm:h-28 sm:w-28" aria-hidden>
      <svg viewBox="0 0 120 120" className={cn("absolute inset-0 h-full w-full", spinning && "motion-safe:animate-[spin_2.4s_linear_infinite]")}>
        <defs>
          <linearGradient id="pv-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-200)" />
            <stop offset="55%" stopColor="var(--gold-500)" />
            <stop offset="100%" stopColor="var(--gold-600)" />
          </linearGradient>
          <path id="pv-ring-text" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="url(#pv-gold)" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          // Rounded: server (Node) and browser trig can differ in the last
          // digit, which would otherwise trip a hydration mismatch.
          return (
            <line
              key={i}
              x1={(60 + Math.cos(a) * 52).toFixed(2)}
              y1={(60 + Math.sin(a) * 52).toFixed(2)}
              x2={(60 + Math.cos(a) * 57).toFixed(2)}
              y2={(60 + Math.sin(a) * 57).toFixed(2)}
              stroke="var(--gold-600)"
              strokeWidth="0.8"
              opacity="0.7"
            />
          );
        })}
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gold-600)" strokeWidth="0.6" opacity="0.8" />
        <text fontSize="6.4" letterSpacing="2.1" fill="var(--gold-600)" fontWeight="700" fontFamily="var(--font-sans)">
          <textPath href="#pv-ring-text">{ringText}</textPath>
        </text>
      </svg>
      <div className="relative grid h-[58%] w-[58%] place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_var(--gold-500)] dark:bg-zinc-950">
        {spinning ? (
          <Loader2 className="h-8 w-8 animate-spin text-[var(--royal-500)]" />
        ) : (
          <ui.Icon className={cn("h-9 w-9", ui.ring)} strokeWidth={2.2} />
        )}
      </div>
    </div>
  );
}

export function SectionCard({
  icon: Icon,
  title,
  kicker,
  children,
  className,
  id,
}: {
  icon: typeof ShieldCheck;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-sm backdrop-blur sm:p-6", className)}>
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--royal-50)] text-[var(--royal-600)] ring-1 ring-[var(--royal-100)]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          {kicker && <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-600)]">{kicker}</p>}
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

export function CheckState({ result, pending }: { result: ProvenanceCheckResult; pending: boolean }) {
  if (pending) return <Loader2 className="h-5 w-5 animate-spin text-[var(--royal-500)]" aria-label="Checking" />;
  if (result === true) return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-label="Match" />;
  if (result === false) return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" aria-label="Mismatch" />;
  if (result === "unavailable") return <CloudOff className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-label="Unreadable" />;
  return <MinusCircle className="h-5 w-5 text-muted-foreground" aria-label="Not applicable" />;
}

export function checkTag(result: ProvenanceCheckResult): { text: string; cls: string } {
  if (result === true) return { text: "Match", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" };
  if (result === false) return { text: "Mismatch", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" };
  if (result === "unavailable") return { text: "Unreadable", cls: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300" };
  return { text: "N/A", cls: "bg-muted text-muted-foreground" };
}

/** The hash as 64 tinted cells, one per hex nibble — matches the strip
 * printed on the PDF certificate, for a quick visual cross-check. */
export function FingerprintStrip({ hash }: { hash: string }) {
  return (
    <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      {hash.slice(0, 64).split("").map((n, i) => (
        <span
          key={i}
          className="h-full flex-1"
          style={{
            background: i % 2 === 0 ? "var(--royal-500)" : "var(--gold-600)",
            opacity: 0.12 + (parseInt(n, 16) / 15) * 0.88,
          }}
        />
      ))}
    </div>
  );
}

export function HashRow({
  label,
  hash,
  copied,
  onCopy,
  highlight,
  fingerprint,
}: {
  label: string;
  hash: string;
  copied: boolean;
  onCopy: () => void;
  highlight: "match" | "none" | null;
  fingerprint?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        highlight === "match" ? "border-emerald-400 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-950/30" : "border-border bg-background/60"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--royal-600)] transition hover:bg-[var(--royal-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="mt-1.5 block break-all font-mono text-[12.5px] leading-relaxed tracking-wide text-foreground">{hash}</code>
      {fingerprint && <FingerprintStrip hash={hash} />}
    </div>
  );
}

export function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("border-b border-border/70 py-3", wide && "sm:col-span-2")}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

