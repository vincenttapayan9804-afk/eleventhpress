"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeNever = () => () => {};

/**
 * True only once hydrated on the client. Deliberately not a
 * useState+useEffect("mounted") pair — that pattern calls setState
 * synchronously inside an effect body, which this repo's `bun run lint`
 * flags (react-hooks/set-state-in-effect); useSyncExternalStore is the
 * idiomatic way to render one value during SSR/the first client render
 * and a different one after, with no setState call at all.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/**
 * Light/dark toggle. next-themes needs a mount check before reading
 * `resolvedTheme` — on the server (and on the client's first render,
 * before hydration) it doesn't yet know the user's OS preference or a
 * previously-stored choice, so rendering based on it too early causes a
 * hydration mismatch. Render a neutral, non-interactive icon until then.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={className} disabled aria-hidden="true">
        <Sun className="h-4 w-4 opacity-0" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
