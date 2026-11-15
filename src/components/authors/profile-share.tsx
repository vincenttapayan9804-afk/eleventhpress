"use client";

import { useState } from "react";
import { Check, Download, Link2, Linkedin, Mail, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Header action: the device's own share sheet where there is one, otherwise copy the link. */
export function ShareProfileButton({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          try {
            await navigator.share({ title: `${name} — author profile`, url });
            return;
          } catch (e: any) {
            if (e?.name === "AbortError") return;
          }
        }
        if (await copy(url)) {
          setCopied(true);
          toast.success("Profile link copied");
          setTimeout(() => setCopied(false), 1800);
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-[var(--royal-50)]"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Link copied" : "Share profile"}
    </button>
  );
}

/** Sidebar card: permanent link, share targets and a QR code that opens the verifiable profile. */
export function ProfileSharePanel({ url, name, qr, fileName }: { url: string; name: string; qr: string | null; fileName: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${name} — verified author profile`;
  const targets = [
    { label: "LinkedIn", Icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: "X", Icon: Twitter, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: "Email", Icon: Mail, href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-1.5 pl-3">
        <Link2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          readOnly
          value={url}
          aria-label="Permanent profile link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
        />
        <button
          type="button"
          onClick={async () => {
            if (await copy(url)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }
          }}
          className="inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {targets.map(({ label, Icon, href }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-[var(--royal-50)]"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </a>
        ))}
      </div>
      {qr && (
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-border bg-white p-3">
          {/* Always on white so every phone camera can read it, in dark mode too. */}
          <img src={qr} alt={`QR code for ${name}'s profile`} width={96} height={96} className="h-24 w-24 flex-shrink-0" />
          <div className="min-w-0 text-xs leading-relaxed text-neutral-600">
            <p className="font-semibold text-neutral-900">Scan to verify</p>
            <p className="mt-0.5">Opens this live profile and its verification record. Add it to a CV, poster or slide.</p>
            <a href={qr} download={fileName} className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[oklch(0.42_0.18_295)] hover:underline">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download QR code
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
