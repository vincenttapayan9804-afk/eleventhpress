"use client";

// The public certificate verification page (/verify/[serial]), in the same
// design as article provenance verification (/verify/article/[id]): hero,
// gold seal verdict panel, step-by-step checks, cryptographic fingerprint
// with "compare a hash", the certified record, a timeline, methodology and
// a side rail with the QR code and the downloadable verification report.

import { useCallback, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Check,
  CircleDashed,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Fingerprint,
  History,
  Link2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CertificateRecord, CertificateTimelineEvent } from "@/lib/certificate-verification-record";
import { CERTIFICATE_SEALED_FIELDS } from "@/lib/certificate-verification-fields";
import {
  CheckState,
  Field,
  HashRow,
  SealEmblem,
  sealRingName,
  SectionCard,
  VERDICT_UI,
  checkTag,
  fmtDate,
  useCopy,
} from "@/components/verification/verify-ui";

type Verdict = CertificateRecord["verdict"];

interface LiveState {
  verdict: Verdict;
  checks: CertificateRecord["checks"];
  checkedAt: string;
  durationMs: number | null;
}

const TITLE: Record<Verdict, string> = {
  verified: "Verified — this certificate is authentic",
  mismatch: "Verification failed — hash mismatch",
};

const BODY: Record<Verdict, string> = {
  verified:
    "The SHA-256 content hash recomputed from the publisher's record of this certificate matches the hash printed on the certificate.",
  mismatch: "The content hash recomputed from the publisher's record does not match the hash on file. Do not treat this certificate as valid.",
};

const TIMELINE_DOT: Record<CertificateTimelineEvent["kind"], string> = {
  issued: "bg-[var(--gold-500)]",
  regenerated: "bg-[var(--royal-500)]",
  verified: "bg-emerald-500",
};

const STEP_COUNT = 3;

export function CertificateVerifyView({ record, qrDataUrl }: { record: CertificateRecord; qrDataUrl: string }) {
  const [live, setLive] = useState<LiveState>({ verdict: record.verdict, checks: record.checks, checkedAt: record.checkedAt, durationMs: null });
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(STEP_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState("");
  const { copied, copy } = useCopy();
  const ui = VERDICT_UI[live.verdict];
  const reportHref = `/api/certificates/verify/${encodeURIComponent(record.serialNumber)}/report`;
  const apiHref = `/api/certificates/verify/${encodeURIComponent(record.serialNumber)}`;

  const reverify = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRevealed(0);
    const started = performance.now();
    try {
      const res = await fetch(apiHref, { cache: "no-store" });
      if (!res.ok) throw new Error(`Verification service responded ${res.status}`);
      const data = (await res.json()) as { verdict: Verdict; checks: CertificateRecord["checks"]; checkedAt?: string };
      const durationMs = Math.round(performance.now() - started);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (let i = 1; i <= STEP_COUNT; i++) {
        if (!reduce) await new Promise((r) => setTimeout(r, 320));
        setRevealed(i);
      }
      setLive({ verdict: data.verdict, checks: data.checks, checkedAt: data.checkedAt ?? new Date().toISOString(), durationMs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-verification failed");
      setRevealed(STEP_COUNT);
    } finally {
      setRunning(false);
    }
  }, [apiHref]);

  const steps = [
    { key: "located", label: "Certificate located", detail: `Serial ${record.serialNumber} is on the publisher's register of issued certificates.`, result: true as const },
    { key: "serial", label: "Serial number well-formed", detail: "The serial follows the publisher's EP-<type>-<code> format.", result: live.checks.serial },
    {
      key: "payload",
      label: "Certified record re-hashed",
      detail: "SHA-256 over the canonical, key-ordered JSON of every certified field equals the content hash printed on the certificate.",
      result: live.checks.payload,
    },
  ];

  const normalized = compare.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  const compareResult = useMemo(() => {
    if (normalized.length < 8) return null;
    if (normalized === record.contentHash) return "exact";
    if (record.contentHash.startsWith(normalized)) return "prefix";
    return "none";
  }, [normalized, record.contentHash]);

  return (
    <main className="relative">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[var(--royal-50)] to-transparent">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--gold-300)_0%,transparent_65%)] opacity-30 blur-2xl dark:opacity-10"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Certificate verification</p>
            <span className="rounded-full border border-[var(--gold-400)]/60 bg-[var(--gold-200)]/40 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-[var(--gold-600)] dark:bg-[var(--gold-600)]/10 dark:text-[var(--gold-300)]">
              {record.serialNumber}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-[2.35rem]">
            {record.typeLabel}
          </h1>
          <p className="mt-3 text-sm text-foreground/80">
            Issued to <span className="font-semibold text-foreground">{record.recipientName}</span>
            <span className="text-muted-foreground"> · {record.categoryLabel}</span>
          </p>
          <p className="mt-1 font-display text-sm italic text-muted-foreground">
            {[record.issuer, record.issn ? `ISSN ${record.issn}` : null, `Issued ${fmtDate(record.issuedAt)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Verdict */}
        <section className={cn("rounded-3xl border p-5 shadow-sm sm:p-7", ui.panel)} aria-live="polite">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <SealEmblem verdict={live.verdict} spinning={running} ringText={`${sealRingName(record.issuer)} · CERTIFICATE VERIFICATION · SHA-256 ·`} />
            <div className="min-w-0 flex-1">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", ui.chip)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {live.verdict === "verified" ? "Authentic" : "Not authentic"}
              </span>
              <h2 className={cn("mt-2 font-display text-xl font-semibold sm:text-2xl", ui.head)}>{running ? "Re-verifying against the register…" : TITLE[live.verdict]}</h2>
              <p className={cn("mt-1.5 max-w-2xl text-sm leading-relaxed", ui.body)}>{BODY[live.verdict]}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Checked live {fmtDate(live.checkedAt, true)}
                {live.durationMs !== null && <> · round-trip {live.durationMs} ms</>}
              </p>
              {error && <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg" className="shadow-md">
              <a href={reportHref} download>
                <Download className="h-4 w-4" /> Download verification report
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={reverify} disabled={running}>
              <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} /> {running ? "Verifying…" : "Re-verify now"}
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href={`${reportHref}?inline=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Preview report
              </a>
            </Button>
            <Button size="lg" variant="ghost" onClick={() => copy("link", record.urls.verify)}>
              {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {copied === "link" ? "Link copied" : "Copy verification link"}
            </Button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <SectionCard icon={BadgeCheck} kicker="Step by step" title="Verification checks performed">
              <ol className="space-y-2">
                {steps.map((s, i) => {
                  const pending = running && i >= revealed;
                  const tag = checkTag(s.result);
                  return (
                    <li key={s.key} className={cn("flex items-start gap-3 rounded-xl border border-border/70 bg-background/50 p-3 transition-all duration-300", pending && "opacity-60")}>
                      <span className="mt-0.5">
                        {running && i > revealed ? <CircleDashed className="h-5 w-5 text-muted-foreground" /> : <CheckState result={s.result} pending={pending} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{s.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
                      </div>
                      {!pending && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tag.cls)}>{tag.text}</span>}
                    </li>
                  );
                })}
              </ol>
            </SectionCard>

            <SectionCard icon={Fingerprint} kicker="SHA-256 · FIPS 180-4" title="Cryptographic fingerprint">
              <div className="space-y-3">
                <HashRow
                  label="Content hash (printed on the certificate)"
                  hash={record.contentHash}
                  copied={copied === "h-content"}
                  onCopy={() => copy("h-content", record.contentHash)}
                  highlight={compareResult === "exact" || compareResult === "prefix" ? "match" : null}
                  fingerprint
                />
                <HashRow
                  label="Recomputed now from the publisher's record"
                  hash={record.recomputedHash}
                  copied={copied === "h-recomputed"}
                  onCopy={() => copy("h-recomputed", record.recomputedHash)}
                  highlight={null}
                />
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-border p-3">
                <label htmlFor="cv-compare" className="text-xs font-semibold">
                  Compare a hash
                </label>
                <p className="text-xs text-muted-foreground">Paste the hash printed on a certificate you were given to check it against this record.</p>
                <input
                  id="cv-compare"
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                  placeholder="e.g. 4b343b686552…"
                  spellCheck={false}
                  autoComplete="off"
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {compareResult && (
                  <p className={cn("mt-2 text-xs font-medium", compareResult === "none" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")} role="status">
                    {compareResult === "exact"
                      ? "Exact match — this is the hash of this certificate."
                      : compareResult === "prefix"
                        ? "Prefix matches this certificate's hash."
                        : "No match — this value does not belong to this certificate."}
                  </p>
                )}
              </div>
              <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
                <Field label="Issued">{fmtDate(record.issuedAt, true)}</Field>
                <Field label="Canonicalisation">Key-ordered JSON, UTF-8</Field>
              </dl>
            </SectionCard>

            <SectionCard icon={Award} kicker="Certified record" title="Certificate details">
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <Field label="Document type">{record.typeLabel}</Field>
                <Field label="Capacity">{record.categoryLabel}</Field>
                <Field label="Issued to">{record.recipientName}</Field>
                <Field label="Issued">{fmtDate(record.issuedAt)}</Field>
                <Field label="Issuing publisher">{record.issuer}</Field>
                <Field label="ISSN">{record.issn ?? "—"}</Field>
                <Field label="Serial number">
                  <span className="font-mono text-[13px]">{record.serialNumber}</span>
                </Field>
                <Field label="Status">
                  <span className={cn("inline-flex items-center gap-1 font-semibold", ui.ring)}>
                    <ui.Icon className="h-4 w-4" /> {live.verdict === "verified" ? "Authentic" : "Not authentic"}
                  </span>
                </Field>
                {record.workTitle && (
                  <Field label="Work cited" wide>
                    <span className="font-display italic">{record.workTitle}</span>
                  </Field>
                )}
              </dl>
            </SectionCard>

            <SectionCard icon={History} kicker="Chain of custody" title="Certificate timeline">
              <ol className="relative ml-2 border-l border-border pl-6">
                {record.timeline.map((e, i) => {
                  const isLive = e.kind === "verified";
                  return (
                    <li key={`${e.at}-${i}`} className="relative pb-5 last:pb-0">
                      <span className={cn("absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-card", TIMELINE_DOT[e.kind], isLive && running && "animate-pulse")} />
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{fmtDate(isLive ? live.checkedAt : e.at, true)}</p>
                      <p className="text-sm font-semibold">
                        {isLive ? (live.verdict === "verified" ? "Independently re-verified (this check)" : "Re-verification failed (hash mismatch)") : e.label}
                      </p>
                      {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                    </li>
                  );
                })}
              </ol>
            </SectionCard>

            <SectionCard icon={ScrollText} kicker="Methodology" title="How this verification works">
              <ol className="space-y-3 text-sm">
                {[
                  ["Issue", "When a certificate is issued, its certified fields are serialised as canonical, key-ordered JSON. The SHA-256 of that JSON is its content hash, printed on the certificate with the serial number and QR code."],
                  ["Re-hash", "Each verification re-reads the publisher's record of the certificate, rebuilds the canonical JSON and recomputes the hash independently."],
                  ["Compare", "If the recomputed hash equals the hash on file, the record is authentic. Any change to a downloaded or printed copy — a name, date, capacity or work title — gives a different hash."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--gold-200)] text-[11px] font-bold text-[var(--gold-600)] dark:bg-[var(--gold-600)]/20 dark:text-[var(--gold-300)]">{i + 1}</span>
                    <p>
                      <span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span>
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Certified fields</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {CERTIFICATE_SEALED_FIELDS.map((f) => (
                  <li key={f} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs">
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Machine-readable check</p>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-100">
                <span className="select-none text-zinc-500">$</span>
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">curl {record.urls.api}</code>
                <button
                  type="button"
                  onClick={() => copy("curl", `curl ${record.urls.api}`)}
                  className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Copy command"
                >
                  {copied === "curl" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Verification depends on {record.issuer || "Eleventh Press International Publishing"}&rsquo;s own records — it is tamper-evident, not
                blockchain-anchored. The verification report confirms this check; the certificate itself stays private to its holder.
              </p>
            </SectionCard>
          </div>

          {/* Side rail */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="bg-gradient-to-br from-[#2a1458] to-[#4c1d95] px-5 py-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2c47e]">{record.typeLabel}</p>
                <p className="mt-1 font-mono text-sm font-semibold tracking-wider">{record.serialNumber}</p>
              </div>
              <div className="p-5">
                <div className="mx-auto w-44 rounded-xl border border-border bg-white p-2">
                  <img src={qrDataUrl} alt={`QR code linking to ${record.urls.verify}`} className="h-auto w-full" width={160} height={160} />
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">Scan to re-verify this certificate on any device.</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className={cn("inline-flex items-center gap-1 font-semibold", ui.ring)}>
                      <ui.Icon className="h-4 w-4" />
                      {live.verdict === "verified" ? "Verified" : "Mismatch"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Issued to</dt>
                    <dd className="text-right font-medium">{record.recipientName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Capacity</dt>
                    <dd className="text-right font-medium">{record.categoryLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd className="font-medium">{fmtDate(record.issuedAt)}</dd>
                  </div>
                </dl>
                <div className="mt-5 grid gap-2">
                  <Button asChild className="w-full">
                    <a href={reportHref} download>
                      <Download className="h-4 w-4" /> Download verification report
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a href={apiHref} target="_blank" rel="noreferrer">
                      <FileJson className="h-4 w-4" /> View JSON record
                    </a>
                  </Button>
                </div>
              </div>
            </div>
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              The verification report is a dated, watermarked snapshot of this check. This live page re-hashes the record on every
              visit and remains authoritative.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
