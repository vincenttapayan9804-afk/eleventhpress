import { db } from "@/lib/db";
import { emailLiveMode } from "@/lib/email";
import { ratelimitLiveMode } from "@/lib/ratelimit";
import { meilisearchLiveMode } from "@/lib/meilisearch";
import { zenodoLiveMode } from "@/lib/zenodo";
import { listPaymentProviders } from "@/lib/payments";

export type ComponentState = "operational" | "degraded" | "down" | "limited";

export interface ComponentStatus {
  key: string;
  name: string;
  state: ComponentState;
  detail: string;
}

/**
 * Health of each part of the platform, for /status and GET /api/health.
 * Only states and plain-language notes — never configuration values.
 */
export async function systemStatus(): Promise<{ overall: ComponentState; checkedAt: string; components: ComponentStatus[] }> {
  const components: ComponentStatus[] = [];

  const t = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const ms = Date.now() - t;
    components.push({ key: "database", name: "Database", state: ms > 1500 ? "degraded" : "operational", detail: `Responding in ${ms} ms` });
  } catch {
    components.push({ key: "database", name: "Database", state: "down", detail: "Not responding" });
  }

  components.push({
    key: "website",
    name: "Website and reading",
    state: components[0].state === "down" ? "down" : "operational",
    detail: components[0].state === "down" ? "Articles can't be loaded right now" : "Articles, search and downloads",
  });

  components.push({
    key: "email",
    name: "Email delivery",
    state: emailLiveMode() ? "operational" : "limited",
    detail: emailLiveMode() ? "Notifications and account emails are being sent" : "Email sending isn't configured",
  });

  const providers = listPaymentProviders();
  const live = providers.filter((p) => p.liveMode);
  components.push({
    key: "payments",
    name: "Payments",
    state: live.length ? "operational" : "limited",
    detail: live.length ? `${live.map((p) => p.label).join(", ")}` : "Running in test mode",
  });

  components.push({
    key: "doi",
    name: "DOI registration",
    state: zenodoLiveMode() ? "operational" : "limited",
    detail: zenodoLiveMode() ? "DOIs are minted on publication" : "Running in test mode",
  });

  components.push({
    key: "search",
    name: "Search",
    state: "operational",
    detail: meilisearchLiveMode() ? "Full-text and semantic search" : "Built-in search",
  });

  components.push({
    key: "security",
    name: "Sign-in protection",
    state: ratelimitLiveMode() ? "operational" : "limited",
    detail: ratelimitLiveMode() ? "Rate limiting and instant sign-out are active" : "Rate limiting isn't configured",
  });

  const overall: ComponentState = components.some((c) => c.state === "down")
    ? "down"
    : components.some((c) => c.state === "degraded")
      ? "degraded"
      : "operational";
  return { overall, checkedAt: new Date().toISOString(), components };
}
