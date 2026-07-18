"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Download,
  Trash2,
  Database,
  Clock,
  Mail,
} from "lucide-react";

/**
 * Describes what the platform actually collects, why, how long it's kept,
 * and the two self-service data-subject rights that are real and wired up
 * (Profile tab → "Your data": export via GET /api/account/export, erasure
 * via POST /api/account/delete). This replaces the footer's former blanket
 * "GDPR / CCPA compliant" badge, which had no real export/delete/consent
 * mechanism behind it — same honesty convention as the Policies page's
 * COPE/Scopus/WoS disclosures: what's implemented, not a claim of external
 * certification.
 */
export function PrivacyView() {
  const { setView, user, openDashboard } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Privacy &amp; data rights</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-justify">
          What we collect, why, how long we keep it, and how to export or erase your own account
          data — self-service, no request form required.
        </p>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">What we collect</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <PrivacyItem
              title="Account profile"
              desc="Name, email, affiliation, ORCID, and any optional bio/social/contact fields you choose to add. Editable any time in your Profile tab."
            />
            <PrivacyItem
              title="Submission & review data"
              desc="Manuscripts, reviews, editorial decisions, and author responses — retained as part of the permanent scholarly and editorial record."
            />
            <PrivacyItem
              title="Payment records"
              desc="Invoice amount, status, and provider reference for APCs/subscriptions. Card numbers are handled entirely by the payment provider — never stored on our servers."
            />
            <PrivacyItem
              title="Usage events"
              desc="Article views/downloads and, for institutional subscribers, COUNTER 5 usage events — includes IP address at the time of the request, used to attribute usage to a subscribing institution."
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">How long we keep it</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-justify">
              Your account profile is kept until you delete it. Published articles, reviews tied to
              a citable DOI, and financial records are retained indefinitely as the permanent
              scholarly and audit record — this is standard practice at every scholarly publisher,
              and consistent with GDPR Art. 17(3)(d)'s archiving exemption. Raw IP addresses
              recorded against usage events are cleared automatically once they're no longer needed
              to attribute usage to an institution — after 90 days.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Your rights</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-md border border-border p-4">
              <Download className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-sm font-semibold">Export your data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Download a JSON copy of your profile, submissions, reviews, invoices, and
                notifications — anytime, from the Profile tab.
              </p>
            </div>
            <div className="rounded-md border border-border p-4">
              <Trash2 className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-sm font-semibold">Delete your account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anonymizes every personal field on your account immediately — bio, avatar, contact
                info, and any signed reviewer attribution switch to "Deleted User." The citable
                author byline on an already-published, DOI-bearing article is a permanent part of
                that DOI's record and is not retroactively changed.
              </p>
            </div>
          </CardContent>
          <CardContent className="flex flex-wrap gap-3 px-6 pb-6 pt-0">
            <Button onClick={() => (user ? openDashboard("profile") : setView("login"))}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Manage my data
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:editorial@eleventhpress.org?subject=Data%20rights%20request">
                <Mail className="mr-2 h-4 w-4" /> Anything else — email us
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">Full detail</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Editorial &amp; ethics policies</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          For how manuscripts, reviews, and corrections are handled, see the Policies page.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setView("policies")}>
            View policies
          </Button>
        </div>
      </section>
    </div>
  );
}

function PrivacyItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
