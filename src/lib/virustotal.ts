/**
 * Malware scanning via VirusTotal's public API v3 — free tier (no paid
 * subscription, unlike iThenticate/src/lib/ithenticate.ts), 500
 * requests/day. Every uploaded file is checked against VirusTotal's full
 * multi-engine corpus before it's trusted.
 *
 * Unlike iThenticate's submit-then-webhook flow, the free public API has
 * no webhook — completion is discovered by polling
 * GET /api/v3/analyses/{id}, driven by the cron sweep in
 * src/lib/malware-scan-job.ts.
 */

const VT_API_BASE = "https://www.virustotal.com/api/v3";
// VirusTotal's direct /files upload endpoint caps at 32MB; larger files
// need a dedicated upload URL from /files/upload_url first (still free,
// same API key, up to 650MB) — relevant here since raw-submissions and
// book-manuscripts both allow uploads up to 50MB (src/lib/uploads.ts).
const DIRECT_UPLOAD_LIMIT_BYTES = 32 * 1024 * 1024;

export function virustotalLiveMode(): boolean {
  return !!process.env.VIRUSTOTAL_API_KEY;
}

async function resolveUploadUrl(apiKey: string, byteLength: number): Promise<string> {
  if (byteLength <= DIRECT_UPLOAD_LIMIT_BYTES) {
    return `${VT_API_BASE}/files`;
  }
  const res = await fetch(`${VT_API_BASE}/files/upload_url`, { headers: { "x-apikey": apiKey } });
  if (!res.ok) {
    throw new Error(`VirusTotal upload_url request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  return body.data as string;
}

/** Uploads a file for analysis. Returns VirusTotal's analysis ID — the verdict itself arrives later, discovered via getVirusTotalAnalysis(). */
export async function submitFileToVirusTotal(bytes: Buffer, filename: string): Promise<string> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY!;
  const uploadUrl = await resolveUploadUrl(apiKey, bytes.length);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), filename);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "x-apikey": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`VirusTotal file submission failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  return body.data.id as string;
}

export interface VirusTotalAnalysisResult {
  status: "queued" | "completed";
  stats?: { malicious: number; suspicious: number; harmless: number; undetected: number };
  permalink: string;
}

/** Polls the analysis. `status: "queued"` means VirusTotal hasn't finished scanning yet — call again later (the cron sweep does this). */
export async function getVirusTotalAnalysis(analysisId: string): Promise<VirusTotalAnalysisResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY!;
  const res = await fetch(`${VT_API_BASE}/analyses/${analysisId}`, { headers: { "x-apikey": apiKey } });
  if (!res.ok) {
    throw new Error(`VirusTotal analysis lookup failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  const attrs = body.data?.attributes || {};
  return {
    status: attrs.status === "completed" ? "completed" : "queued",
    stats: attrs.stats,
    permalink: `https://www.virustotal.com/gui/file-analysis/${analysisId}`,
  };
}
