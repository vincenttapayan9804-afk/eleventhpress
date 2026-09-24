"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Mounts next-themes so the `.dark` class toggle (and thus the full dark
 * palette already defined in globals.css — `@custom-variant dark
 * (&:is(.dark *))`, two `.dark { ... }` blocks) actually does something.
 * The CSS side of dark mode has existed since Whitelabel/branding work
 * landed; this was the missing wiring — no ThemeProvider was mounted
 * anywhere, so the tokens sat unused. See ThemeToggle for the switch UI.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props}>
      {children}
    </NextThemesProvider>
  );
}
