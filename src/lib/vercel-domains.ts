/**
 * Whitelabel Phase 3 — thin wrapper around Vercel's Domains API, which is
 * what actually provisions SSL for a tenant's custom domain once it's DNS-
 * verified. Same honesty convention as src/lib/virustotal.ts and
 * src/lib/ratelimit.ts: without VERCEL_API_TOKEN/VERCEL_PROJECT_ID configured,
 * every call here no-ops with `skipped: true` rather than pretending to
 * succeed — the domain still resolves correctly at the application layer
 * (DNS verification + TenantDomain lookup), it just won't have Vercel-
 * managed SSL until an operator adds it to the project by hand or sets
 * these env vars.
 */

interface VercelDomainResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

function vercelConfig() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId };
}

function withTeam(url: string, teamId?: string): string {
  return teamId ? `${url}${url.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}` : url;
}

export async function addDomainToVercelProject(hostname: string): Promise<VercelDomainResult> {
  const cfg = vercelConfig();
  if (!cfg) {
    return {
      ok: false,
      skipped: true,
      error: "VERCEL_API_TOKEN/VERCEL_PROJECT_ID not configured — domain verified at the application layer only. Add it to the Vercel project manually (or set those env vars) to provision SSL.",
    };
  }
  const url = withTeam(`https://api.vercel.com/v10/projects/${cfg.projectId}/domains`, cfg.teamId);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: hostname }),
  });
  if (res.ok) return { ok: true };
  const json = await res.json().catch(() => ({}) as any);
  if (res.status === 409 || json?.error?.code === "domain_already_in_use") {
    // Already attached to this project — treat as success.
    return { ok: true };
  }
  return { ok: false, error: json?.error?.message || `Vercel API error (${res.status})` };
}

export async function removeDomainFromVercelProject(hostname: string): Promise<VercelDomainResult> {
  const cfg = vercelConfig();
  if (!cfg) return { ok: false, skipped: true };
  const url = withTeam(`https://api.vercel.com/v10/projects/${cfg.projectId}/domains/${encodeURIComponent(hostname)}`, cfg.teamId);
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${cfg.token}` } });
  if (res.ok || res.status === 404) return { ok: true };
  const json = await res.json().catch(() => ({}) as any);
  return { ok: false, error: json?.error?.message || `Vercel API error (${res.status})` };
}
