"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-client";

type Mode = "INSTANT" | "DAILY" | "OFF";
interface Category { key: string; label: string; description: string }
interface Prefs { emailMode: Mode; mutedCategories: string[] }

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "INSTANT", label: "As it happens", hint: "One email per update" },
  { key: "DAILY", label: "Daily summary", hint: "One email a day" },
  { key: "OFF", label: "Don't email me", hint: "Dashboard only" },
];

/** Profile → "Email notifications": how and which notifications reach the inbox. */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ preferences: Prefs; categories: Category[] }>("/api/notifications/preferences")
      .then((r) => {
        setPrefs(r.preferences);
        setCategories(r.categories);
      })
      .catch(() => setPrefs({ emailMode: "INSTANT", mutedCategories: [] }))
      .finally(() => {
        // Arriving from an email's "Email preferences" link (/dashboard/profile#notifications).
        if (window.location.hash === "#notifications") {
          window.setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      });
  }, []);

  const save = async (next: Prefs) => {
    const previous = prefs;
    setPrefs(next);
    setSaving(true);
    try {
      await apiFetch("/api/notifications/preferences", { method: "PUT", body: JSON.stringify(next) });
      toast.success("Email preferences saved");
    } catch (e: any) {
      setPrefs(previous);
      toast.error("Couldn't save preferences", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="paper-card scroll-mt-24" id="notifications">
      <CardHeader>
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Bell className="h-4 w-4 text-primary" /> Email notifications
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h3>
        <p className="text-xs text-muted-foreground">
          Everything always appears under the bell in the header. Choose what also reaches your inbox. Security and
          sign-in emails are always sent.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!prefs ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div role="radiogroup" aria-label="How often to email you" className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={prefs.emailMode === m.key}
                  onClick={() => prefs.emailMode !== m.key && save({ ...prefs, emailMode: m.key })}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    prefs.emailMode === m.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.hint}</span>
                </button>
              ))}
            </div>
            <ul className={`divide-y divide-border rounded-lg border border-border ${prefs.emailMode === "OFF" ? "opacity-50" : ""}`}>
              {categories.map((c) => {
                const on = !prefs.mutedCategories.includes(c.key);
                return (
                  <li key={c.key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                    <Switch
                      checked={on}
                      disabled={prefs.emailMode === "OFF"}
                      aria-label={`Email me about ${c.label.toLowerCase()}`}
                      onCheckedChange={(v) =>
                        save({
                          ...prefs,
                          mutedCategories: v ? prefs.mutedCategories.filter((k) => k !== c.key) : [...prefs.mutedCategories, c.key],
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
