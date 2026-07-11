"use client";

import { useApp, type Locale } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages, Check } from "lucide-react";

const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "fil", label: "Filipino", nativeLabel: "Filipino" },
  { code: "zh-Hans", label: "Chinese (Simplified)", nativeLabel: "简体中文" },
];

export function LanguageSwitcher() {
  const locale = useApp((s) => s.locale);
  const setLocale = useApp((s) => s.setLocale);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2.5" aria-label="Change language">
          <Languages className="h-4 w-4" />
          <span className="hidden text-xs font-medium sm:inline">{current.nativeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong w-48">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLocale(l.code)} className="justify-between">
            <span>
              {l.nativeLabel}
              {l.nativeLabel !== l.label && (
                <span className="ml-1.5 text-xs text-muted-foreground">({l.label})</span>
              )}
            </span>
            {locale === l.code && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
