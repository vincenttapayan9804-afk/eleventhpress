"use client";

import type { ComponentType } from "react";
import { useApp } from "@/lib/store";
import { useContactEmail, useLegalIdentity } from "@/lib/tenant-branding-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accessibility,
  Archive,
  Cpu,
  FileCheck2,
  KeyRound,
  LifeBuoy,
  Lock,
  Mail,
  ScrollText,
  Server,
  ShieldCheck,
  Siren,
} from "lucide-react";

/**
 * Trust Center: one public page listing the free, open standards the
 * platform implements and how, for librarians, funders, institutional
 * security reviewers and authors. Same honesty convention as
 * AccessibilityView/PoliciesView: every row describes something that exists
 * in this codebase today; self-assessments are labelled as such (there is
 * no third-party audit or paid certification behind them), and anything
 * still rolling out says so.
 */

type Status = "in-place" | "self-assessed" | "rolling-out";

const STATUS_LABEL: Record<Status, string> = {
  "in-place": "In place",
  "self-assessed": "Self-assessed",
  "rolling-out": "Rolling out",
};

const STATUS_CLASS: Record<Status, string> = {
  "in-place": "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "self-assessed": "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "rolling-out": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

interface Row {
  standard: string;
  what: string;
  status: Status;
}

const SECURITY: Row[] = [
  { standard: "OWASP ASVS 5.0 · Level 2", what: "Application security requirements checked area by area: input handling and output encoding, authentication, sessions, access control, cryptography, secure communication, data protection, configuration and logging.", status: "self-assessed" },
  { standard: "NIST Cybersecurity Framework 2.0", what: "Controls organised under Govern, Identify, Protect, Detect, Respond and Recover — see the breakdown below.", status: "self-assessed" },
  { standard: "CIS Critical Security Controls v8 · IG1", what: "The essential-hygiene safeguards: software inventory, secure configuration, account and access management, data protection, audit logs, malware and vulnerability management, incident response.", status: "self-assessed" },
  { standard: "RFC 9116 security.txt", what: "A published, machine-readable contact for reporting vulnerabilities at /.well-known/security.txt.", status: "in-place" },
  { standard: "CycloneDX SBOM", what: "A software bill of materials generated automatically on every change, listing every component and version shipped.", status: "in-place" },
  { standard: "Automated code scanning", what: "Static analysis (Semgrep), secret scanning (Gitleaks) and dependency updates (Dependabot) run on every change and block a release when they fail.", status: "in-place" },
];

const CSF: { fn: string; items: string }[] = [
  { fn: "Govern", items: "Published security, privacy, accessibility and AI policies; role-based permissions; each whitelabel portal's data isolated by Postgres row-level security." },
  { fn: "Identify", items: "Software bill of materials, automated dependency inventory and updates, a documented data inventory and cookie inventory." },
  { fn: "Protect", items: "TLS everywhere with HSTS preload, a strict Content-Security-Policy, bcrypt password hashing, TOTP two-factor and passkeys (WebAuthn), AES-256-GCM encryption for sensitive fields, CSRF tokens, HTTP-only session cookies and rate limiting." },
  { fn: "Detect", items: "Code and secret scanning on every change, audit logs of privileged actions, and continuous health checks on the public status page." },
  { fn: "Respond", items: "The incident response plan below, with a public vulnerability-disclosure contact." },
  { fn: "Recover", items: "Managed Postgres with provider backups and point-in-time recovery, a documented restore runbook, and recovery targets below." },
];

const EMAIL: Row[] = [
  { standard: "SPF", what: "Lists the only servers allowed to send mail for the domain.", status: "in-place" },
  { standard: "DKIM", what: "Every outgoing message is cryptographically signed.", status: "in-place" },
  { standard: "DMARC", what: "Tells receiving servers to reject or quarantine mail that fails SPF/DKIM — stops look-alike phishing from our domain.", status: "in-place" },
  { standard: "MTA-STS (RFC 8461) + TLS-RPT", what: "Incoming mail must arrive over verified encryption; delivery failures are reported to us.", status: "rolling-out" },
];

const PRIVACY: Row[] = [
  { standard: "EU / UK GDPR", what: "Lawful bases recorded, data-subject rights honoured (access, correction, export, erasure), records of processing kept.", status: "in-place" },
  { standard: "Philippine Data Privacy Act (RA 10173)", what: "Privacy notice, a privacy contact, and breach notification to the National Privacy Commission and affected people within 72 hours.", status: "in-place" },
  { standard: "CCPA / CPRA", what: "No personal data is sold or shared for advertising; requests to know or delete are honoured.", status: "in-place" },
  { standard: "Global Privacy Control", what: "A browser's GPC signal is honoured automatically as an opt-out of every optional cookie — declared at /.well-known/gpc.json.", status: "in-place" },
];

const SCHOLARLY: Row[] = [
  { standard: "COPE Core Practices · ICMJE", what: "Ethics, authorship, conflicts of interest, corrections and retractions handled to COPE flowcharts and ICMJE recommendations.", status: "in-place" },
  { standard: "Crossref DOIs + Crossmark", what: "Every article gets a persistent DOI; Crossmark shows readers if it has been corrected or retracted.", status: "in-place" },
  { standard: "ORCID · ROR · CRediT (NISO Z39.104)", what: "Persistent identifiers for authors and institutions, and the 14-role contributor taxonomy.", status: "in-place" },
  { standard: "JATS · OAI-PMH 2.0 · Dublin Core", what: "Standard full-text XML and a harvesting endpoint for indexers and repositories.", status: "in-place" },
  { standard: "FAIR Signposting", what: "Machine-readable links from each article page to its DOI, authors, PDF, metadata and licence — and back from the PDF.", status: "in-place" },
  { standard: "KBART (NISO RP-9)", what: "A title list libraries load into their catalogues and link resolvers: /api/export/kbart.", status: "in-place" },
  { standard: "COUNTER Release 5 · SUSHI", what: "Standardised usage statistics libraries can harvest.", status: "in-place" },
  { standard: "TOP Guidelines (2025)", what: "Transparency and openness practices — see the statement below.", status: "in-place" },
];

const TOP: { practice: string; level: string }[] = [
  { practice: "Study registration", level: "Disclosed — authors state whether and where the study was registered." },
  { practice: "Study protocol", level: "Disclosed — authors state whether a protocol exists and where it can be found." },
  { practice: "Analysis plan", level: "Disclosed — authors state whether the analysis was pre-specified." },
  { practice: "Materials transparency", level: "Disclosed — authors state where materials can be obtained." },
  { practice: "Data transparency", level: "Disclosed, sharing encouraged — every article carries a data availability statement; datasets can be deposited and cited with their own DOI." },
  { practice: "Analytic code transparency", level: "Disclosed, sharing encouraged — authors state where code is available and may cite it as a dataset." },
  { practice: "Reporting transparency", level: "Disclosed — authors follow the relevant reporting guideline (e.g. CONSORT, PRISMA, STROBE) and say which." },
];

const ARCHIVING: { version: string; policy: string }[] = [
  { version: "Submitted version (preprint)", policy: "May be posted anywhere, at any time, including before submission." },
  { version: "Accepted manuscript", policy: "May be posted in any repository or website on acceptance, with no embargo, under CC BY 4.0." },
  { version: "Published version", policy: "Open access immediately under CC BY 4.0 — may be posted anywhere, with no embargo." },
  { version: "Conditions", policy: "Authors retain copyright. Please link to the published version with its DOI." },
];

const AI_ROWS: Row[] = [
  { standard: "EU AI Act · Article 50 transparency", what: "Every feature that generates text or images with AI is labelled as AI-generated where you see the output.", status: "in-place" },
  { standard: "COPE position on AI and authorship", what: "AI tools cannot be listed as authors; authors must disclose any use of generative AI in writing, data or images.", status: "in-place" },
  { standard: "Human oversight", what: "AI suggestions that change published content (alt text, translations, accessibility fixes) are reviewed and approved by an editor before they appear.", status: "in-place" },
];

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={`shrink-0 whitespace-nowrap text-[10px] ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function Section({
  icon: Icon,
  title,
  intro,
  children,
  id,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  intro?: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section className="mt-12 scroll-mt-24" id={id} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id={`${id}-title`} className="font-display text-2xl font-semibold">{title}</h2>
      </div>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <Card className="paper-card">
      <CardContent className="divide-y divide-border p-0">
        {rows.map((r) => (
          <div key={r.standard} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">{r.standard}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.what}</p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PairList({ rows, keyLabel }: { rows: { a: string; b: string }[]; keyLabel: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-0">
        <dl className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.a} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6">
              <dt className="font-display text-sm font-semibold">
                <span className="sr-only">{keyLabel}: </span>
                {r.a}
              </dt>
              <dd className="text-xs leading-relaxed text-muted-foreground">{r.b}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

const NAV = [
  { id: "security", label: "Security" },
  { id: "incidents", label: "Incidents" },
  { id: "email", label: "Email" },
  { id: "privacy", label: "Privacy" },
  { id: "accessibility", label: "Accessibility" },
  { id: "scholarly", label: "Open scholarship" },
  { id: "archiving", label: "Archiving" },
  { id: "ai", label: "AI" },
];

export function TrustView() {
  const legal = useLegalIdentity();
  const contactEmail = useContactEmail();
  const { setView } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Trust Center</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          The open standards {legal.orgName} follows for security, privacy, accessibility, open scholarship and
          responsible AI — and exactly how we meet each one. Items marked <em>self-assessed</em> are checked by us
          against the published standard, not certified by an outside auditor.
        </p>
        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="security" icon={ShieldCheck} title="Security" intro="Free, widely recognised frameworks that institutional security reviews ask about.">
        <RowList rows={SECURITY} />
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">NIST CSF 2.0 at a glance</p>
        <div className="mt-2">
          <PairList keyLabel="Function" rows={CSF.map((c) => ({ a: c.fn, b: c.items }))} />
        </div>
      </Section>

      <Section
        id="incidents"
        icon={Siren}
        title="Incident response & continuity"
        intro="What happens when something goes wrong, and how quickly."
      >
        <Card className="paper-card">
          <CardContent className="p-6">
            <ol className="space-y-3 text-sm">
              {[
                ["Detect & triage", "Every alert or report is assessed and given a severity within 1 hour during staffed hours."],
                ["Contain", "Affected accounts, keys or features are isolated; credentials are rotated where needed."],
                ["Notify", "If personal data may be affected, we tell the people involved and the relevant regulator (the National Privacy Commission, or an EU/UK authority) within 72 hours of becoming aware."],
                ["Recover", "Service is restored from known-good code and data, then verified."],
                ["Learn", "A plain-language incident summary is posted on the status page, and the fix is tracked to completion."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-semibold">{t}.</span>{" "}
                    <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Recovery point target</p>
                <p className="font-display text-lg font-semibold">≤ 24 hours</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Recovery time target</p>
                <p className="font-display text-lg font-semibold">≤ 4 hours</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Live service status</p>
                <a href="/status" className="font-display text-lg font-semibold text-primary underline-offset-2 hover:underline">
                  Status page
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section id="email" icon={Mail} title="Email authenticity" intro="So messages from us can be trusted, and nobody can convincingly send mail pretending to be us.">
        <RowList rows={EMAIL} />
      </Section>

      <Section id="privacy" icon={Lock} title="Privacy">
        <RowList rows={PRIVACY} />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => setView("privacy")}>Privacy Policy</Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/cookie-policy">Cookie Policy</a>
          </Button>
        </div>
      </Section>

      <Section id="accessibility" icon={Accessibility} title="Accessibility">
        <RowList
          rows={[
            { standard: "WCAG 2.2 Level AA", what: "Our target for every page; automated axe-core checks run on every change and block a release on failure.", status: "self-assessed" },
            { standard: "Accessibility Conformance Report (VPAT 2.5 INT)", what: "A criterion-by-criterion report covering WCAG 2.2, US Section 508 and EU EN 301 549, published on our Accessibility page.", status: "self-assessed" },
            { standard: "EPUB Accessibility 1.1", what: "Every e-book declares its accessibility features, and only claims WCAG conformance when every image has a text alternative.", status: "in-place" },
            { standard: "Language of page (WCAG 3.1.1)", what: "The page language follows the language you choose, so screen readers read it with the right voice.", status: "in-place" },
          ]}
        />
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setView("accessibility")}>Accessibility statement & report</Button>
        </div>
      </Section>

      <Section id="scholarly" icon={FileCheck2} title="Open scholarship" intro="Standards that let indexers, libraries and funders find, verify and reuse what we publish.">
        <RowList rows={SCHOLARLY} />
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TOP Guidelines statement</p>
        <div className="mt-2">
          <PairList keyLabel="Practice" rows={TOP.map((t) => ({ a: t.practice, b: t.level }))} />
        </div>
      </Section>

      <Section
        id="archiving"
        icon={Archive}
        title="Self-archiving & preservation"
        intro="Our author self-archiving policy, in the form used by Sherpa Romeo and institutional repositories."
      >
        <PairList keyLabel="Version" rows={ARCHIVING.map((a) => ({ a: a.version, b: a.policy }))} />
        <Card className="paper-card mt-4">
          <CardContent className="p-6 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Preservation.</span> Our public{" "}
              <a href="/preservation-manifest" className="text-primary underline-offset-2 hover:underline">preservation manifest</a>{" "}
              carries the LOCKSS permission statement, so CLOCKSS and other LOCKSS-network archives may collect and preserve
              every published issue; dark-archive status is tracked per journal and only announced once an archive confirms it. Articles and datasets can also be
              deposited in Zenodo (CERN), which keeps a permanent copy with its own DOI.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section id="ai" icon={Cpu} title="Responsible AI" intro="Where this platform uses AI, and the rules around it.">
        <RowList rows={AI_ROWS} />
      </Section>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <LifeBuoy className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-semibold">Questions or a security report?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Security researchers, librarians and institutional reviewers are welcome to contact us. We acknowledge
          vulnerability reports within 3 working days.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <a href={`mailto:${contactEmail}?subject=Security%20report`}>
              <KeyRound className="mr-2 h-4 w-4" /> Report a vulnerability
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/.well-known/security.txt">
              <ScrollText className="mr-2 h-4 w-4" /> security.txt
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/status">
              <Server className="mr-2 h-4 w-4" /> Platform status
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
