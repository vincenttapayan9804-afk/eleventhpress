"use client";

import { useApp } from "@/lib/store";
import { Globe } from "lucide-react";

export function SiteFooter() {
  const setView = useApp((s) => s.setView);
  return (
    <footer className="mt-auto">
      <div className="royal-divider" />
      <div className="glass border-t border-[oklch(0.76_0.11_294/0.1)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <span className="wax-mark">EP</span>
                <div>
                  <p className="font-display text-lg font-semibold text-royal-gradient">
                    Eleventh Press International Publishing
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Peer-reviewed · Open access · Crossref registered · OAI-PMH 2.0
                  </p>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                A multidisciplinary journal of uncompromising editorial rigor, publishing
                original research across the natural sciences, engineering, social sciences,
                and humanities. Academic luxury meets scholarly authority.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                ISSN 2945-1138 · Publisher prefix 10.52011 · Editorial office: London, United Kingdom
              </p>
            </div>

            <div>
              <p className="eyebrow mb-3">Explore</p>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => setView("home")} className="text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors">Home</button></li>
                <li><button onClick={() => setView("browse")} className="text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors">All articles</button></li>
                <li><button onClick={() => setView("about")} className="text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors">About the journal</button></li>
                <li><a href="/api/oai-pmh?verb=Identify" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors"><Globe className="h-3 w-3" /> OAI-PMH endpoint</a></li>
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-3">Policies</p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>Open access (CC BY 4.0)</li>
                <li>Double-blind peer review</li>
                <li>Crossref DOI deposit</li>
                <li>GDPR / CCPA compliant</li>
                <li>PCI-DSS across all payment gateways</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[oklch(0.76_0.11_294/0.1)] pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} Eleventh Press International Publishing. All articles published under CC BY 4.0 unless otherwise noted.</p>
            <p className="font-mono">Indexed: Google Scholar · Crossref · OAI-PMH · DOAJ</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
