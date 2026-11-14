"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenText,
  Check,
  ChevronDown,
  CircleDashed,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Fingerprint,
  History,
  Landmark,
  Link2,
  Quote,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEALED_FIELDS } from "@/lib/article-provenance";
import type { ProvenanceRecord, ProvenanceTimelineEvent } from "@/lib/article-provenance-record";
import type { ProvenanceCheckResult, ProvenanceChecks, ProvenanceVerdict } from "@/lib/article-provenance-server";
import { cn } from "@/lib/utils";
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
import { withTrademark } from "@/lib/brand-mark";

function verdictBody(verdict: ProvenanceVerdict, unavailable: string[]): string {
  if (verdict === "verified") {
    return "The SHA-256 content hash recomputed from the stored record, and the file hashes recomputed from the actual stored PDF/EPUB bytes, all match the sealed record.";
  }
  if (verdict === "unavailable") {
    return `The ${unavailable.join(" and ")} file couldn't be read from storage just now, so it couldn't be re-hashed. This is not evidence of tampering — please re-verify shortly.`;
  }
  return "A recomputed hash does not match the record on file. Do not treat this article's metadata or files as unaltered since they were sealed.";
}

const TIMELINE_DOT: Record<ProvenanceTimelineEvent["kind"], string> = {
  submitted: "bg-[var(--royal-400)]",
  accepted: "bg-[var(--royal-500)]",
  published: "bg-[var(--royal-600)]",
  sealed: "bg-[var(--gold-500)]",
  correction: "bg-amber-500",
  verified: "bg-emerald-500",
};

/* ────────────────────────────────────────────────────────────────────────
 * Main view
 * ──────────────────────────────────────────────────────────────────────── */

interface LiveState {
  verdict: ProvenanceVerdict;
  checks: ProvenanceChecks;
  unavailable: string[];
  checkedAt: string;
  durationMs: number | null;
}

const STEP_KEYS = ["record", "metadata", "pdf", "epub"] as const;
type StepKey = (typeof STEP_KEYS)[number];

export function ProvenanceVerifyView({ record, qrDataUrl }: { record: ProvenanceRecord; qrDataUrl: string }) {
  const [live, setLive] = useState<LiveState>({
    verdict: record.verdict,
    checks: record.checks,
    unavailable: record.unavailable,
    checkedAt: record.checkedAt,
    durationMs: null,
  });
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState<number>(STEP_KEYS.length);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState("");
  const [citeId, setCiteId] = useState(record.citations[0]?.id ?? "apa");
  const [abstractOpen, setAbstractOpen] = useState(false);
  const { copied, copy } = useCopy();

  const ui = VERDICT_UI[live.verdict];

  const reverify = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRevealed(0);
    const started = performance.now();
    try {
      const res = await fetch(`/api/articles/${record.id}/verify`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Verification service responded ${res.status}`);
      const data = (await res.json()) as {
        verdict: ProvenanceVerdict;
        checks: ProvenanceChecks;
        unavailableFiles?: string[];
        checkedAt?: string;
      };
      const durationMs = Math.round(performance.now() - started);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (let i = 1; i <= STEP_KEYS.length; i++) {
        if (!reduce) await new Promise((r) => setTimeout(r, 320));
        setRevealed(i);
      }
      setLive({
        verdict: data.verdict,
        checks: data.checks,
        unavailable: data.unavailableFiles ?? [],
        checkedAt: data.checkedAt ?? new Date().toISOString(),
        durationMs,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-verification failed");
      setRevealed(STEP_KEYS.length);
    } finally {
      setRunning(false);
    }
  }, [record.id]);

  const steps: { key: StepKey; label: string; detail: string; result: ProvenanceCheckResult }[] = [
    { key: "record", label: "Published record located", detail: `Article ${record.id} is in PUBLISHED status.`, result: true },
    { key: "metadata", label: "Canonical metadata re-hashed", detail: "SHA-256 over the canonical, key-ordered JSON of every sealed field equals the sealed content hash.", result: live.checks.metadata },
    { key: "pdf", label: "PDF galley bytes re-hashed", detail: "SHA-256 of the archived PDF equals the hash recorded in the seal.", result: live.checks.pdf },
    { key: "epub", label: "EPUB galley bytes re-hashed", detail: "SHA-256 of the archived EPUB equals the hash recorded in the seal.", result: live.checks.epub },
  ];

  const normalizedCompare = compare.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  const compareTarget = useMemo(() => {
    if (normalizedCompare.length < 8) return null;
    const entries: [string, string | null][] = [
      ["content", record.hashes.content],
      ["pdf", record.hashes.pdf],
      ["epub", record.hashes.epub],
    ];
    const exact = entries.find(([, h]) => h && h === normalizedCompare);
    if (exact) return { key: exact[0], exact: true };
    const prefix = entries.find(([, h]) => h && h.startsWith(normalizedCompare));
    return prefix ? { key: prefix[0], exact: false } : { key: null, exact: false };
  }, [normalizedCompare, record.hashes]);

  const cite = record.citations.find((c) => c.id === citeId) ?? record.citations[0];
  const certificateHref = `/api/articles/${record.id}/verify/certificate`;
  const journalLine = [
    record.journal.name,
    record.issue ? `Vol. ${record.issue.volume}, No. ${record.issue.issueNumber} (${record.issue.year})` : null,
  ].filter(Boolean).join(" · ");

  const downloadText = (filename: string, text: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[var(--royal-50)] to-transparent">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--gold-300)_0%,transparent_65%)] opacity-30 blur-2xl dark:opacity-10"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Digital provenance verification</p>
            <span className="rounded-full border border-[var(--gold-400)]/60 bg-[var(--gold-200)]/40 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-[var(--gold-600)] dark:bg-[var(--gold-600)]/10 dark:text-[var(--gold-300)]">
              {record.sealReference}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-[2.35rem]">
            {record.title}
          </h1>
          {record.authors.length > 0 && (
            <p className="mt-3 text-sm text-foreground/80">
              {record.authors.map((a, i) => (
                <span key={`${a.name}-${i}`}>
                  {a.name}
                  {a.orcid && (
                    <a
                      href={a.orcid.startsWith("http") ? a.orcid : `https://orcid.org/${a.orcid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 inline-grid h-4 w-4 translate-y-[2px] place-items-center rounded-full bg-[#a6ce39] text-[8px] font-bold text-white"
                      aria-label={`ORCID iD of ${a.name}`}
                    >
                      iD
                    </a>
                  )}
                  {i < record.authors.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}
          <p className="mt-1 font-display text-sm italic text-muted-foreground">{journalLine}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* ── Verdict ─────────────────────────────────────────────────── */}
        <section className={cn("rounded-3xl border p-5 shadow-sm sm:p-7", ui.panel)} aria-live="polite">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <SealEmblem
              verdict={live.verdict}
              spinning={running}
              ringText={`${sealRingName(record.brand?.publisher)} · DIGITAL PROVENANCE · SHA-256 ·`}
            />
            <div className="min-w-0 flex-1">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", ui.chip)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {live.verdict === "verified" ? "Authentic" : live.verdict === "unavailable" ? "Retry shortly" : "Not authentic"}
              </span>
              <h2 className={cn("mt-2 font-display text-xl font-semibold sm:text-2xl", ui.head)}>
                {running ? "Re-verifying against the archive…" : ui.title}
              </h2>
              <p className={cn("mt-1.5 max-w-2xl text-sm leading-relaxed", ui.body)}>{verdictBody(live.verdict, live.unavailable)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Checked live {fmtDate(live.checkedAt, true)}
                {live.durationMs !== null && <> · round-trip {live.durationMs} ms</>}
                {" · "}Seal rules v{record.sealVersion}
              </p>
              {error && <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg" className="shadow-md">
              <a href={certificateHref} download>
                <Download className="h-4 w-4" /> Download PDF certificate
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={reverify} disabled={running}>
              <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} /> {running ? "Verifying…" : "Re-verify now"}
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href={`${certificateHref}?inline=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Preview certificate
              </a>
            </Button>
            <Button size="lg" variant="ghost" onClick={() => copy("link", record.urls.verify)}>
              {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {copied === "link" ? "Link copied" : "Copy verification link"}
            </Button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Main column ────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-6">
            <SectionCard icon={BadgeCheck} kicker="Step by step" title="Verification checks performed">
              <ol className="space-y-2">
                {steps.map((s, i) => {
                  const pending = running && i >= revealed;
                  const tag = checkTag(s.result);
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border border-border/70 bg-background/50 p-3 transition-all duration-300",
                        pending && "opacity-60"
                      )}
                    >
                      <span className="mt-0.5">
                        {running && i > revealed ? <CircleDashed className="h-5 w-5 text-muted-foreground" /> : <CheckState result={s.result} pending={pending} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{s.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
                      </div>
                      {!pending && (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tag.cls)}>{tag.text}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </SectionCard>

            <SectionCard icon={Fingerprint} kicker="SHA-256 · FIPS 180-4" title="Cryptographic fingerprint">
              <div className="space-y-3">
                <HashRow
                  label="Content hash (sealed record)"
                  hash={record.hashes.content}
                  copied={copied === "h-content"}
                  onCopy={() => copy("h-content", record.hashes.content)}
                  highlight={compareTarget?.key === "content" ? "match" : null}
                  fingerprint
                />
                {record.hashes.pdf && (
                  <HashRow
                    label="PDF galley — stored bytes"
                    hash={record.hashes.pdf}
                    copied={copied === "h-pdf"}
                    onCopy={() => copy("h-pdf", record.hashes.pdf!)}
                    highlight={compareTarget?.key === "pdf" ? "match" : null}
                  />
                )}
                {record.hashes.epub && (
                  <HashRow
                    label="EPUB galley — stored bytes"
                    hash={record.hashes.epub}
                    copied={copied === "h-epub"}
                    onCopy={() => copy("h-epub", record.hashes.epub!)}
                    highlight={compareTarget?.key === "epub" ? "match" : null}
                  />
                )}
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-border p-3">
                <label htmlFor="pv-compare" className="text-xs font-semibold">
                  Compare a hash
                </label>
                <p className="text-xs text-muted-foreground">
                  Paste a hash from a printed certificate, citation record or another system to check it against this seal.
                </p>
                <input
                  id="pv-compare"
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                  placeholder="e.g. 2d8b4d75d966…"
                  spellCheck={false}
                  autoComplete="off"
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {compareTarget && (
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium",
                      compareTarget.key ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                    )}
                    role="status"
                  >
                    {compareTarget.key
                      ? `${compareTarget.exact ? "Exact match" : "Prefix matches"} — ${compareTarget.key === "content" ? "sealed content hash" : `${compareTarget.key.toUpperCase()} galley hash`}.`
                      : "No match — this value does not belong to this seal."}
                  </p>
                )}
              </div>
              <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
                <Field label="Sealed">{fmtDate(record.dates.sealedAt, true)}</Field>
                <Field label="Seal rules">v{record.sealVersion} (current v{record.currentSealVersion})</Field>
                <Field label="Recorded seal events">{record.sealCount || 1}</Field>
                <Field label="Canonicalisation">Key-ordered JSON, UTF-8</Field>
              </dl>
            </SectionCard>

            <SectionCard icon={Landmark} kicker="Scholarly metadata" title="Bibliographic record">
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <Field label="Journal">{record.journal.name}</Field>
                <Field label="ISSN">{record.journal.issn ?? "—"}</Field>
                <Field label="Publisher">{withTrademark(record.journal.publisher)}</Field>
                <Field label="Volume / issue">
                  {record.issue ? `Vol. ${record.issue.volume}, No. ${record.issue.issueNumber} (${record.issue.year})` : "Continuous publication"}
                </Field>
                <Field label="Content type">
                  {record.contentTypeLabel}
                  {record.insightCategoryLabel ? ` — ${record.insightCategoryLabel}` : ""}
                </Field>
                <Field label="Discipline">{record.discipline}</Field>
                <Field label="Peer review">{record.reviewModelLabel}</Field>
                <Field label="Version of record">Version {record.versionNumber}</Field>
                <Field label="DOI">
                  {record.doi ? (
                    <a href={`https://doi.org/${record.doi}`} target="_blank" rel="noreferrer" className="text-[var(--royal-600)] underline-offset-4 hover:underline">
                      https://doi.org/{record.doi}
                    </a>
                  ) : (
                    "Not yet assigned"
                  )}
                </Field>
                <Field label="Archive record">{record.zenodoRecordId ? `Zenodo record ${record.zenodoRecordId}` : "—"}</Field>
                <Field label="Submitted">{fmtDate(record.dates.submittedAt)}</Field>
                <Field label="Accepted">{fmtDate(record.dates.acceptedAt)}</Field>
                <Field label="Published">{fmtDate(record.dates.publishedAt)}</Field>
                <Field label="Post-publication status">
                  <span className={cn(record.integrityStatus !== "NORMAL" && "text-amber-700 dark:text-amber-300")}>{record.integrityStatusLabel}</span>
                </Field>
                <Field label="License">
                  <a href={record.license.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                    {record.license.name}
                  </a>{" "}
                  <span className="text-muted-foreground">— reuse with attribution permitted</span>
                </Field>
                {record.funders.length > 0 && <Field label="Funding">{record.funders.join("; ")}</Field>}
                {record.keywords.length > 0 && (
                  <Field label="Keywords" wide>
                    <span className="flex flex-wrap gap-1.5">
                      {record.keywords.map((k) => (
                        <span key={k} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-normal">
                          {k}
                        </span>
                      ))}
                    </span>
                  </Field>
                )}
              </dl>
              {record.corrections.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Post-publication notices</p>
                  <ul className="mt-1 space-y-1 text-amber-900/90 dark:text-amber-200/80">
                    {record.corrections.map((c, i) => (
                      <li key={i}>
                        {c.type} · {fmtDate(c.issuedAt)} — {c.title}
                        {c.doi && <> (doi:{c.doi})</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setAbstractOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--royal-600)]"
                  aria-expanded={abstractOpen}
                >
                  <BookOpenText className="h-4 w-4" /> {abstractOpen ? "Hide" : "Show"} sealed abstract
                  <ChevronDown className={cn("h-4 w-4 transition-transform", abstractOpen && "rotate-180")} />
                </button>
                {abstractOpen && (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-foreground/90">{record.abstract}</p>
                )}
              </div>
            </SectionCard>

            {record.authors.length > 0 && (
              <SectionCard icon={Users} kicker="Contributors" title="Authors & affiliations">
                <ol className="grid gap-3 sm:grid-cols-2">
                  {record.authors.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="rounded-xl border border-border/70 bg-background/50 p-3">
                      <div className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5b2bb5] to-[#2a1458] text-xs font-semibold text-white">
                          {a.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{a.name}</p>
                          {a.affiliation && <p className="text-xs text-muted-foreground">{a.affiliation}</p>}
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                            {a.orcid && (
                              <a
                                href={a.orcid.startsWith("http") ? a.orcid : `https://orcid.org/${a.orcid}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[#5b7f12] underline-offset-2 hover:underline dark:text-[#a6ce39]"
                              >
                                ORCID {a.orcid.replace(/^https?:\/\/orcid\.org\//, "")}
                              </a>
                            )}
                            {a.rorId && (
                              <a href={`https://ror.org/${a.rorId}`} target="_blank" rel="noreferrer" className="font-mono text-muted-foreground underline-offset-2 hover:underline">
                                ROR {a.rorId}
                              </a>
                            )}
                          </div>
                          {a.creditRoles && a.creditRoles.length > 0 && (
                            <p className="mt-1 text-[11px] italic text-muted-foreground">CRediT: {a.creditRoles.join(", ")}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            )}

            <SectionCard icon={History} kicker="Chain of custody" title="Provenance timeline">
              <ol className="relative ml-2 border-l border-border pl-6">
                {record.timeline.map((e, i) => {
                  const isLive = e.kind === "verified";
                  return (
                    <li key={`${e.at}-${i}`} className="relative pb-5 last:pb-0">
                      <span className={cn("absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-card", TIMELINE_DOT[e.kind], isLive && running && "animate-pulse")} />
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {fmtDate(isLive ? live.checkedAt : e.at, e.kind === "sealed" || isLive)}
                      </p>
                      <p className="text-sm font-semibold">
                        {isLive
                          ? live.verdict === "verified"
                            ? "Independently re-verified (this check)"
                            : live.verdict === "unavailable"
                              ? "Re-verification attempted (storage unavailable)"
                              : "Re-verification failed (hash mismatch)"
                          : e.label}
                      </p>
                      {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                    </li>
                  );
                })}
              </ol>
            </SectionCard>

            <SectionCard icon={Quote} kicker="Citation" title="Cite this record">
              <div role="tablist" aria-label="Citation style" className="flex flex-wrap gap-1.5">
                {record.citations.map((c) => (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={c.id === cite?.id}
                    onClick={() => setCiteId(c.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      c.id === cite?.id
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {cite && (
                <div className="mt-3 rounded-xl border-l-[3px] border-[var(--gold-500)] bg-muted/50 p-4">
                  {cite.id === "bibtex" || cite.id === "ris" ? (
                    <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed">{cite.text}</pre>
                  ) : (
                    <p className="font-display text-[15px] leading-relaxed">{cite.text}</p>
                  )}
                </div>
              )}
              {cite && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(`cite-${cite.id}`, cite.text)}>
                    {copied === `cite-${cite.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === `cite-${cite.id}` ? "Copied" : "Copy citation"}
                  </Button>
                  {(cite.id === "bibtex" || cite.id === "ris") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        downloadText(
                          `${(record.doi ?? record.id).replace(/[^a-z0-9]+/gi, "-")}.${cite.id === "bibtex" ? "bib" : "ris"}`,
                          cite.text,
                          cite.id === "bibtex" ? "application/x-bibtex" : "application/x-research-info-systems"
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Download .{cite.id === "bibtex" ? "bib" : "ris"}
                    </Button>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={ScrollText} kicker="Methodology" title="How this verification works">
              <ol className="space-y-3 text-sm">
                {[
                  ["Seal", "At publication, every sealed input below is serialised as canonical, key-ordered JSON together with the SHA-256 of the exact PDF and EPUB bytes placed in the archive. Its SHA-256 is the content hash."],
                  ["Re-hash", "Each verification re-reads the stored record and re-downloads the archived galleys, recomputes all three hashes independently, and compares them with the seal."],
                  ["Reseal with audit", "When the platform itself legitimately changes a sealed input — registering the DOI or regenerating the galleys — the record is resealed and the event is written to the audit log shown in the timeline."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--gold-200)] text-[11px] font-bold text-[var(--gold-600)] dark:bg-[var(--gold-600)]/20 dark:text-[var(--gold-300)]">
                      {i + 1}
                    </span>
                    <p>
                      <span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span>
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sealed inputs</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {SEALED_FIELDS.map((f) => (
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
                Individually downloaded copies carry a per-reader provenance stamp, so their file hashes intentionally differ from
                the archived galleys verified here. Verification depends on {withTrademark(record.brand?.publisher) || "Eleventh Press International Publishing™"}&rsquo;s own
                records and archive storage — it is tamper-evident, not blockchain-anchored. It proves authenticity and does not
                restrict reading, sharing or reuse: this work is licensed CC BY 4.0.
              </p>
            </SectionCard>
          </div>

          {/* ── Side rail ──────────────────────────────────────────────── */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="bg-gradient-to-br from-[#2a1458] to-[#4c1d95] px-5 py-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2c47e]">Certificate of digital provenance</p>
                <p className="mt-1 font-mono text-sm font-semibold tracking-wider">{record.sealReference}</p>
              </div>
              <div className="p-5">
                <div className="mx-auto w-44 rounded-xl border border-border bg-white p-2">
                  <img src={qrDataUrl} alt={`QR code linking to ${record.urls.verify}`} className="h-auto w-full" width={160} height={160} />
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">Scan to re-verify this record on any device.</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className={cn("inline-flex items-center gap-1 font-semibold", ui.ring)}>
                      <ui.Icon className="h-4 w-4" />
                      {live.verdict === "verified" ? "Verified" : live.verdict === "unavailable" ? "Unavailable" : "Mismatch"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Published</dt>
                    <dd className="font-medium">{fmtDate(record.dates.publishedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Sealed</dt>
                    <dd className="font-medium">{fmtDate(record.dates.sealedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">License</dt>
                    <dd className="font-medium">{record.license.name}</dd>
                  </div>
                </dl>
                <div className="mt-5 grid gap-2">
                  <Button asChild className="w-full">
                    <a href={certificateHref} download>
                      <Download className="h-4 w-4" /> Download PDF certificate
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a href={`/api/articles/${record.id}/verify`} target="_blank" rel="noreferrer">
                      <FileJson className="h-4 w-4" /> View JSON record
                    </a>
                  </Button>
                  <Button asChild variant="ghost" className="w-full">
                    <a href={`/article/${record.id}`}>
                      <BookOpenText className="h-4 w-4" /> Read the article
                    </a>
                  </Button>
                </div>
              </div>
            </div>
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              The PDF certificate is a dated, watermarked snapshot of this verification. This live page re-hashes the record and
              files on every visit and remains authoritative.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
